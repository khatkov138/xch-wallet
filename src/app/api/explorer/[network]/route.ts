import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { createApiResponse } from "@/lib/server-utils"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface BlockchainStateResponse {
  success: boolean;
  blockchain_state: {
    difficulty: number; space: number; mempool_size: number;
    sync: { synced: boolean };
    peak: { height: number; header_hash: string } | null;
  };
}

interface ChiaBlockRecordResponse {
  success: boolean;
  block_record: {
    height: number; header_hash: string; timestamp: number | null;
    reward_claims_incorporated: Array<{ amount: number | string; puzzle_hash: string }> | null;
    fees: number | string | null; transaction_block: boolean;
  };
}

// Вспомогательная функция для фетча цены без сторонних тяжелых либ
async function getChiaMarketData() {
  return new Promise<{ price: number; marketCap: number }>((resolve) => {
    https.get("https://coingecko.com", {
      headers: { "User-Agent": "Mozilla/5.0" }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ price: json.chia.usd, marketCap: json.chia.usd_market_cap });
        } catch {
          resolve({ price: 0, marketCap: 0 }); // фоллбэк при лимитах API
        }
      });
    }).on("error", () => resolve({ price: 0, marketCap: 0 }));
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ network: string }> }): Promise<NextResponse> {
  const resolvedParams = await params;
  const network = resolvedParams.network.toLowerCase();

  return createApiResponse(async () => {
    const homeDir = process.env.USERPROFILE || os.homedir() || "C:\\Users\\khatk";
    let sslPath = path.join(homeDir, ".chia", network, "config", "ssl", "full_node");
    let certPath = path.join(sslPath, "private_full_node.crt");
    let keyPath = path.join(sslPath, "private_full_node.key");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
      certPath = path.join(sslPath, "private_full_node.crt");
      keyPath = path.join(sslPath, "private_full_node.key");
    }

    const agent = new https.Agent({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath), rejectUnauthorized: false });

    const callRpc = async <T>(endpoint: string, payload: object = {}): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = https.request(`https://localhost:8555/${endpoint}`, {
          method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body, "utf8") },
          agent, timeout: 6000
        }, (res) => {
          let chunks = "";
          res.on("data", (chunk: string) => chunks += chunk);
          res.on("end", () => { try { resolve(JSON.parse(chunks) as T); } catch { reject(new Error("JSON error")); } });
        });
        req.on("error", reject); req.write(body); req.end();
      });
    };

    // Собираем всё параллельно: состояние ноды и рыночные данные коина
    const [stateData, marketData] = await Promise.all([
      callRpc<BlockchainStateResponse>("get_blockchain_state"),
      getChiaMarketData()
    ]);

    if (!stateData.success) throw new Error("State failed");

    const state = stateData.blockchain_state;
    const currentHeight = state.peak?.height ?? 0;

    // Расчет Netspace в Exabytes (EiB) или Petabytes (PiB) как на Spacescan
    let netspaceFormatted = "0.00 EiB";
    if (state.space) {
      const spaceBig = BigInt(state.space);
      const PiB = 1024n ** 5n;
      const EiB = 1024n ** 6n;
      netspaceFormatted = spaceBig >= EiB 
        ? `${(Number(spaceBig) / Number(EiB)).toFixed(2)} EiB`
        : `${(Number(spaceBig) / Number(PiB)).toFixed(2)} PiB`;
    }

    // Расчет XCH Farmed (Эмуляция общего сапплая на основе высоты халвингов Chia)
    // Базовый премайн 21M + награды за блоки (минус халвинги)
    const baseHalvingBlocks = 5045760; 
    let totalFarmedXch = 21000000; 
    if (currentHeight > 0) {
      if (currentHeight <= baseHalvingBlocks) {
        totalFarmedXch += currentHeight * 2; // первые 3 года по 2 XCH за блок
      } else {
        totalFarmedXch += (baseHalvingBlocks * 2) + ((currentHeight - baseHalvingBlocks) * 1); // халвинг до 1 XCH
      }
    }

    const latestBlocks: any[] = [];
    const latestTransactions: any[] = [];

    if (currentHeight > 0) {
      const queries: Promise<ChiaBlockRecordResponse>[] = [];
      for (let i = 0; i < 5; i++) {
        const tHeight = currentHeight - i;
        if (tHeight >= 0) queries.push(callRpc<ChiaBlockRecordResponse>("get_block_record_by_height", { height: tHeight }));
      }

      const blockResults = await Promise.all(queries);

      for (const res of blockResults) {
        if (res.success && res.block_record) {
          const br = res.block_record;
          const rewardClaims = br.reward_claims_incorporated || [];
          const totalMojo = rewardClaims.reduce((acc, c) => acc + BigInt(c.amount || 0), 0n);
          const blockRewardXch = (Number(totalMojo) / 1000000000000).toFixed(2);
          const feesXch = br.fees ? (Number(br.fees) / 1000000000000).toFixed(6) : "0.000000";

          latestBlocks.push({
            height: br.height,
            hash: br.header_hash,
            isTransaction: !!br.transaction_block,
            reward: blockRewardXch,
            fees: feesXch,
          });

          // Собираем транзакции вознаграждений фермеров (Latest Transactions) как на скрине Spacescan
          if (rewardClaims.length > 0) {
            rewardClaims.forEach((claim, idx) => {
              latestTransactions.push({
                id: `${br.height}_${idx}`,
                txHash: br.header_hash.slice(0, 16) + "...",
                amount: (Number(claim.amount) / 1000000000000).toFixed(2),
                toPuzzleHash: claim.puzzle_hash.slice(0, 10) + "..." + claim.puzzle_hash.slice(-6)
              });
            });
          }
        }
      }
    }

    return {
      network,
      isSynced: state.sync.synced,
      blockHeight: currentHeight,
      netspaceFormatted,
      mempoolSize: state.mempool_size ?? 0,
      // Добавленные маркет-параметры высокой информативности
      chiaPrice: marketData.price ? `$${marketData.price.toFixed(2)}` : "$0.00",
      marketCap: marketData.marketCap ? `$${(marketData.marketCap / 1_000_000).toFixed(1)}M` : "NaN",
      xchFarmed: totalFarmedXch.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      latestBlocks,
      latestTransactions: latestTransactions.slice(0, 5) // Забираем последние 5 транзакций
    };
  });
}
