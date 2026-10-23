import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { createApiResponse } from "@/lib/server-utils"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ network: string; height: string }> }
): Promise<NextResponse> {
  const { height } = await params;
  const targetHeight = parseInt(height, 10);

  return createApiResponse(async () => {
    const homeDir = process.env.USERPROFILE || os.homedir() || "C:\\Users\\khatk";
    
    // Всегда берем сертификаты из папки mainnet, чтобы роут не падал при запросе testnet11
    let sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node");
    let certPath = path.join(sslPath, "private_full_node.crt");
    let keyPath = path.join(sslPath, "private_full_node.key");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
      certPath = path.join(sslPath, "private_full_node.crt");
      keyPath = path.join(sslPath, "private_full_node.key");
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error("SSL certificates completely missing in mainnet folder");
    }

    const agent = new https.Agent({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath), rejectUnauthorized: false });

    const callRpc = async (endpoint: string, body: object): Promise<any> => {
      return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = https.request(`https://localhost:8555/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload, "utf8") },
          agent,
          timeout: 8000
        }, (res) => {
          let chunks = "";
          res.on("data", (chunk) => chunks += chunk);
          res.on("end", () => { try { resolve(JSON.parse(chunks)); } catch { reject(new Error("JSON Parse error")); } });
        });
        req.on("error", reject); req.write(payload); req.end();
      });
    };

    // ШАГ 1: По высоте блока получаем block_record (награды и комиссии)
    const recordData = await callRpc("get_block_record_by_height", { height: targetHeight });
    if (!recordData.success || !recordData.block_record) {
      throw new Error(`Block record at height ${targetHeight} not found`);
    }

    const br = recordData.block_record;
    const headerHash = br.header_hash;

    // Расчет наград фермера из блок-рекорда
    const rewardClaims = br.reward_claims_incorporated || [];
    const totalMojo = rewardClaims.reduce((acc: bigint, c: any) => acc + BigInt(c.amount || 0), 0n);
    const rewardXch = (Number(totalMojo) / 1000000000000).toFixed(2);
    
    // Расчет комиссий из блок-рекорда
    const feesXch = br.fees ? (Number(br.fees) / 1000000000000).toFixed(6) : "0.000000";

    // ШАГ 2: По полученному хэшу запрашиваем у Full Node тяжелый консенсусный блок
    const blockData = await callRpc("get_block", { header_hash: headerHash });
    if (!blockData.success || !blockData.block) {
      throw new Error(`Full block data not found for hash ${headerHash}`);
    }

    const b = blockData.block;
    const blockTimestamp = b.foliage?.foliage_block_data?.timestamp || null;

    return {
      height: targetHeight,
      hash: headerHash,
      prevHash: b.foliage?.prev_block_hash || "Genesis",
      weight: b.reward_chain_block?.weight?.toString() || "0",
      // ЖЕСТКИЙ ФИКС: Определение типа блока теперь строго завязано на наличие timestamp,
      // чтобы статус на фронтенде не противоречил подвалу карточки
      totalTransactions: blockTimestamp ? "Да ( transaction block )" : "Нет ( только консенсус )",
      farmerPuzzleHash: b.foliage?.foliage_block_data?.farmer_reward_puzzle_hash || "Не указан",
      poolPuzzleHash: b.foliage?.foliage_block_data?.pool_target?.puzzle_hash || "Не указан",
      timestamp: blockTimestamp,
      rewardXch,
      feesXch
    };
  });
}
