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

interface NetworkInfoResponse {
  success: boolean;
  network_name: string; // Четкое имя сети из RPC
}

// Хелпер для человекочитаемого размера сети
function formatNetworkSpace(spaceBytes: number): string {
  if (!spaceBytes) return "0.00 TiB";
  const tib = spaceBytes / Math.pow(1024, 4);
  if (tib >= 1024 * 1024) {
    return `${(tib / (1024 * 1024)).toFixed(2)} EiB`;
  }
  if (tib >= 1024) {
    return `${(tib / 1024).toFixed(2)} PiB`;
  }
  return `${tib.toFixed(2)} TiB`;
}

export async function GET(): Promise<NextResponse> {
  return createApiResponse(async () => {
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";

    // Сертификаты берем строго из папки mainnet
    let sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node");
    let certPath = path.join(sslPath, "private_full_node.crt");
    let keyPath = path.join(sslPath, "private_full_node.key");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
      certPath = path.join(sslPath, "private_full_node.crt");
      keyPath = path.join(sslPath, "private_full_node.key");
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`SSL-сертификаты Full Node отсутствуют в папке mainnet.`);
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

    // Делаем ровно 3 параллельных запроса к RPC ноды
    const [netData, stateData, connData] = await Promise.all([
      fetchChiaRpc<NetworkInfoResponse>("get_network_info"),
      fetchChiaRpc<BlockchainStateResponse>("get_blockchain_state"),
      fetchChiaRpc<ConnectionsResponse>("get_connections")
    ]);

    if (!netData.success || !stateData.success || !connData.success) {
      throw new Error("Chia RPC вернул success: false");
    }

    const state = stateData.blockchain_state;
    const currentHeight = state.peak?.height ?? 0;
    
    const targetHeight = state.sync.synced 
      ? currentHeight 
      : (state.sync.sync_tip_height > 0 ? state.sync.sync_tip_height : currentHeight);
    
    let progressPercent = "0.0000";
    if (state.sync.synced) {
      progressPercent = "100.0000";
    } else if (targetHeight > 0) {
      progressPercent = ((currentHeight / targetHeight) * 100).toFixed(4);
    }

    const peakTime = state.peak && state.peak.timestamp > 0
      ? new Date(state.peak.timestamp * 1000).toISOString()
      : null;

    const fullNodeConnections = connData.connections.filter(c => c.type === 1);

    return {
      network: netData.network_name, // Поле железно возвращает строку ('mainnet' или 'testnet11') прямо из RPC
      isSynced: state.sync.synced,
      isSyncingMode: state.sync.sync_mode,
      currentHeight,
      targetHeight,
      progressPercent,
      difficulty: state.difficulty ?? 0,
      networkSpaceFormatted: formatNetworkSpace(state.space),
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
