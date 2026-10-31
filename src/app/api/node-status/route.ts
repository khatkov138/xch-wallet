import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { createApiResponse } from "@/lib/utils/server-utils"

// Отключаем панику Node.js из-за самоподписанных SSL-сертификатов Chia
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface ChiaConnection {
  node_id: string;
  peer_host: string;
  peer_port: number;
  type: number; // 1 = Full Node
  last_message_time: number;
  bytes_read: number;
  bytes_written: number;
}

interface BlockchainStateResponse {
  success: boolean;
  blockchain_state: {
    difficulty: number;
    space: number;
    sync: {
      sync_mode: boolean;
      sync_progress_height: number;
      sync_tip_height: number;
      synced: boolean;
    };
    peak: {
      height: number;
      header_hash: string;
      timestamp: number;
    } | null;
  };
}

interface ConnectionsResponse {
  success: boolean;
  connections: ChiaConnection[];
}

export async function GET(): Promise<NextResponse> {
  return createApiResponse(async () => {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
    const networkFolder = isTestnet ? "testnet11" : "mainnet";
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";

    let sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "full_node");
    let certPath = path.join(sslPath, "private_full_node.crt");
    let keyPath = path.join(sslPath, "private_full_node.key");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node");
      certPath = path.join(sslPath, "private_full_node.crt");
      keyPath = path.join(sslPath, "private_full_node.key");
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
      certPath = path.join(sslPath, "private_full_node.crt");
      keyPath = path.join(sslPath, "private_full_node.key");
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`SSL-сертификаты Full Node отсутствуют в системе.`);
    }

    const agent = new https.Agent({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      rejectUnauthorized: false
    });

    const fetchChiaRpc = async <T>(endpoint: string): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const req = https.request(
          `https://localhost:8555/${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            agent: agent,
            timeout: 4000
          },
          (res) => {
            let chunks = "";
            res.on("data", (chunk: string) => { chunks += chunk; });
            res.on("end", () => {
              try { resolve(JSON.parse(chunks) as T); } catch { reject(new Error(`Error parsing JSON for ${endpoint}`)); }
            });
          }
        );
        req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout ${endpoint}`)); });
        req.on("error", (err) => reject(err));
        req.write(JSON.stringify({}));
        req.end();
      });
    };

    const [stateData, connData] = await Promise.all([
      fetchChiaRpc<BlockchainStateResponse>("get_blockchain_state"),
      fetchChiaRpc<ConnectionsResponse>("get_connections")
    ]);

    if (!stateData.success || !connData.success) {
      throw new Error("Chia RPC вернул success: false");
    }

    const state = stateData.blockchain_state;
    const currentHeight = state.peak?.height ?? 0;
    
    // Исправляем логику таргет-высоты: если нода говорит synced, значит таргет равен текущей высоте
    const targetHeight = state.sync.synced 
      ? currentHeight 
      : (state.sync.sync_tip_height > 0 ? state.sync.sync_tip_height : currentHeight);
    
    let progressPercent = "0.0000";
    if (state.sync.synced) {
      progressPercent = "100.0000";
    } else if (targetHeight > 0) {
      progressPercent = ((currentHeight / targetHeight) * 100).toFixed(4);
    }

    // Никакой отсебятины. Только ISO строка времени блока или null, если блока нет
    const peakTime = state.peak && state.peak.timestamp > 0
      ? new Date(state.peak.timestamp * 1000).toISOString()
      : null;

    const fullNodeConnections = connData.connections.filter(c => c.type === 1);

    // Сухой возврат данных без лишнего текста
    return {
      network: networkFolder,
      isSynced: state.sync.synced,
      isSyncingMode: state.sync.sync_mode,
      currentHeight,
      targetHeight,
      progressPercent,
      difficulty: state.difficulty ?? 0,
      networkSpaceTib: state.space ? (state.space / Math.pow(1024, 4)).toFixed(2) : "0.00",
      peakTime,
      totalPeers: fullNodeConnections.length,
      peersList: fullNodeConnections.map(c => ({
        ip: c.peer_host,
        port: c.peer_port,
        trafficUpMb: (c.bytes_written / (1024 * 1024)).toFixed(2),
        trafficDownMb: (c.bytes_read / (1024 * 1024)).toFixed(2)
      }))
    };
  });
}
