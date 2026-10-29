import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { getContractAddressByPublicKey } from "@/lib/crypto" // Твоя общая утилита
import { createApiResponse } from "@/lib/server-utils"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface ChiaCoinRecord {
  amount: number | string;
  spent_block_index?: number;
  confirmed_block_index?: number;
  spent_height?: number;
  confirmed_height?: number;
  spent: boolean;
  id?: string;
  timestamp?: number;
  coin: { amount: number | string; parent_coin_info: string; puzzle_hash: string; };
  [key: string]: unknown;
}

interface ChiaRpcFullNodeResult { success: boolean; coin_records?: ChiaCoinRecord[]; error?: string; }
interface CleanTransaction { name: string; to_address: string; amount: string; confirmed_at_time: number; type: number; index: number; }

const MOJO_PER_XCH = 1000000000000n;

function formatMojoToXch(mojo: bigint): string {
  const mojoStr = mojo.toString(); if (mojo === 0n) return "0";
  if (mojo < MOJO_PER_XCH) { const padded = mojoStr.padStart(12, "0"); return `0.${padded}`.replace(/\.?0+$/, ""); }
  const integerPart = mojoStr.slice(0, -12); const fractionalPart = mojoStr.slice(-12).replace(/0+$/, "");
  return fractionalPart.length > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const publicKeyHex = searchParams.get("publicKeyHex");

  if (!publicKeyHex) {
    return NextResponse.json({ success: false, data: null, error: "publicKeyHex query parameter is required" }, { status: 400 });
  }

  return createApiResponse<CleanTransaction[]>(async () => {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
    const prefix = isTestnet ? "txch" : "xch";
    const networkFolder = isTestnet ? "testnet11" : "mainnet";
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";

    let sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "full_node");
    let certPath = path.join(sslPath, "private_full_node.crt"), keyPath = path.join(sslPath, "private_full_node.key");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
      certPath = path.join(sslPath, "private_full_node.crt"); keyPath = path.join(sslPath, "private_full_node.key");
    }
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) throw new Error(`SSL-сертификаты Full Node полностью отсутствуют в системе.`);

    const agent = new https.Agent({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath), rejectUnauthorized: false });

    const indexToHashMap = new Map<string, { index: number; address: string; }>();
    const puzzleHashesList: string[] = [];

    // 1. ГЕНЕРИРУЕМ КАРТУ СДВИГОВ ДЛЯ ВСЕХ 100 УНИКАЛЬНЫХ ИНДЕКСОВ
    for (let index = 0; index < 100; index++) {
      // Вызываем правильный метод с незакаленной деривацией
      const { puzzleHash, address } = getContractAddressByPublicKey(publicKeyHex, index, prefix);
      const pHashLower = puzzleHash.toLowerCase();

      if (!indexToHashMap.has(pHashLower)) {
        puzzleHashesList.push(puzzleHash);
        indexToHashMap.set(pHashLower, { index, address });
      }
    }

    // include_spent_coins: true — заставляем ноду поднять архивные удаленные монеты для вывода исходящих трат (type 2)
    const rpcPayload = JSON.stringify({ puzzle_hashes: puzzleHashesList, include_spent_coins: true });

    const nodeResponseData = await new Promise<ChiaRpcFullNodeResult>((resolve, reject) => {
      const req = https.request("https://localhost:8555/get_coin_records_by_puzzle_hashes", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json", "Content-Length": Buffer.byteLength(rpcPayload, "utf8") }, agent, timeout: 20000 }, (res) => {
        const chunks: Buffer[] = []; res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as ChiaRpcFullNodeResult); } catch { reject(new Error("Ошибка парсинга JSON ответа ноды")); } });
      });
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout ответа ноды")); });
      req.on("error", (err) => reject(err)); req.write(rpcPayload, "utf8"); req.end();
    });

    if (!nodeResponseData.success) throw new Error(nodeResponseData.error || "Full Node RPC Error");

    const coinRecords = nodeResponseData.coin_records || [];
    const SECONDS_PER_BLOCK = 18.75;
    const finalHistory: CleanTransaction[] = [];

    // 2. ОБРАБАТЫВАЕМ ИСТОРИЮ ТРАТ
    for (const record of coinRecords) {
      if (!record.coin) continue;

      const coinPuzzleHash = record.coin.puzzle_hash.toLowerCase();
      
      // Сверяем хэши с учетом возможных вариаций префикса 0x
      let meta = indexToHashMap.get(coinPuzzleHash);
      if (meta === undefined && !coinPuzzleHash.startsWith("0x")) {
        meta = indexToHashMap.get("0x" + coinPuzzleHash);
      }
      if (!meta) continue;

      const amountMojo = BigInt(record.coin.amount);
      const amountXch = formatMojoToXch(amountMojo);
      const fallbackCoinId = record.id || `${record.coin.parent_coin_info.slice(0, 10)}_${record.coin.amount}`;

      const cHeight = record.confirmed_block_index ?? record.confirmed_height ?? 0;
      const sHeight = record.spent_block_index ?? record.spent_height ?? 0;
      const baseTimestamp = record.timestamp ?? Math.floor(Date.now() / 1000);

      // Входящая операция (type: 1) — когда монета родилась на этом индексе
      let cTimestamp = baseTimestamp;
      if (record.spent && sHeight > cHeight) {
        cTimestamp = baseTimestamp - Math.floor((sHeight - cHeight) * SECONDS_PER_BLOCK);
      }

      finalHistory.push({
        name: fallbackCoinId,
        to_address: meta.address,
        amount: amountXch,
        confirmed_at_time: cTimestamp,
        type: 1,
        index: meta.index
      });

      // Исходящая операция (type: 2) — фиксируем факт уничтожения/траты монеты с этого индекса
      if (record.spent) {
        finalHistory.push({
          name: fallbackCoinId,
          to_address: meta.address,
          amount: amountXch,
          confirmed_at_time: baseTimestamp,
          type: 2,
          index: meta.index
        });
      }
    }

    // Выстраиваем всю историю кошелька по хронологии от новых к старым
    finalHistory.sort((a, b) => b.confirmed_at_time - a.confirmed_at_time);
    return finalHistory;
  });
}
