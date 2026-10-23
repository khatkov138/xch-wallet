import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { createApiResponse } from "@/lib/server-utils"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ network: string; coinId: string }> }
): Promise<NextResponse> {
  const { coinId } = await params;

  return createApiResponse(async () => {
    const homeDir = process.env.USERPROFILE || os.homedir() || "C:\\Users\\khatk";
    const sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node");
    const cert = fs.readFileSync(path.join(sslPath, "private_full_node.crt"));
    const key = fs.readFileSync(path.join(sslPath, "private_full_node.key"));
    const agent = new https.Agent({ cert, key, rejectUnauthorized: false });

    const callRpc = async (endpoint: string, body: object): Promise<any> => {
      return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = https.request(`https://localhost:8555/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload, "utf8") },
          agent
        }, (res) => {
          let chunks = "";
          res.on("data", (chunk) => chunks += chunk);
          res.on("end", () => { try { resolve(JSON.parse(chunks)); } catch { reject(new Error("JSON Parse error")); } });
        });
        req.on("error", reject); req.write(payload); req.end();
      });
    };

    // Парсим наш составной ID (например, "4864805_0")
    const parts = coinId.split("_");
    const blockHeight = parseInt(parts[0], 10);
    const rewardIndex = parseInt(parts[1], 10) || 0;

    if (isNaN(blockHeight)) {
      throw new Error("Invalid Coin ID format. Expected height_index");
    }

    // Запрашиваем запись блока, где гарантированно лежат награды
    const recordData = await callRpc("get_block_record_by_height", { height: blockHeight });
    if (!recordData.success || !recordData.block_record) {
      throw new Error(`Block record at height ${blockHeight} not found`);
    }

    const br = recordData.block_record;
    const rewardClaims = br.reward_claims_incorporated || [];
    const targetClaim = rewardClaims[rewardIndex];

    if (!targetClaim) {
      throw new Error(`Reward claim with index ${rewardIndex} not found in block ${blockHeight}`);
    }

    // Возвращаем чистый контракт данных, который ожидает твоя страница page.tsx
    return {
      coinId: coinId,
      amountXch: (Number(targetClaim.amount) / 1000000000000).toFixed(2),
      puzzleHash: targetClaim.puzzle_hash,
      parentCoinInfo: targetClaim.parent_coin_info || "Сгенерировано протоколом ( Награда )",
      confirmedHeight: blockHeight,
      spentHeight: br.spent_block_index ? `#${br.spent_block_index}` : "Не потрачена ( Доступно )",
      isSpent: !!br.spent_block_index
    };
  });
}
