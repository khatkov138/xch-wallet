import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { bech32m } from "bech32"
import { clvmTree, parseCLVMBytes } from "@/lib/crypto"
import { createApiResponse } from "@/lib/server-utils"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface ChiaCoinRecord {
  amount: number | string;
  spent_height?: number;
  confirmed_height?: number;
  coinbase: boolean;
  id: string; 
  coin: { amount: number | string; parent_coin_info: string; puzzle_hash: string; };
  spent: boolean;
  [key: string]: unknown;
}

interface ChiaRpcBalanceResult { success: boolean; coin_records: ChiaCoinRecord[]; error?: string; }
interface IndexRecord { index: number; puzzle_hash: string; address: string; xch: string; mojo: string; coins: ChiaCoinRecord[]; }
interface FullBalanceResponse { total_xch: string; total_mojo: string; addresses: IndexRecord[]; }

const MOJO_PER_XCH = 1000000000000n;

function formatMojoToXch(mojo: bigint): string {
  const mojoStr = mojo.toString(); if (mojo === 0n) return "0";
  if (mojo < MOJO_PER_XCH) { const padded = mojoStr.padStart(12, "0"); return `0.${padded}`.replace(/\.?0+$/, ""); }
  const integerPart = mojoStr.slice(0, -12); const fractionalPart = mojoStr.slice(-12).replace(/0+$/, "");
  return fractionalPart.length > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
}

const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const toBytes = (h: string) => { const c = h.replace(/^0x|\s+/g, '').toLowerCase(); return new Uint8Array(c.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))); };

function encodePuzzleHashToAddress(puzzleHashHex: string, isTestnet: boolean): string {
  const cleanHex = puzzleHashHex.replace(/^0x/i, "");
  const words = bech32m.toWords(toBytes(cleanHex));
  const prefix = isTestnet ? "txch" : "xch";
  return bech32m.encode(prefix, words);
}

function generateContractPuzzleHash(publicKeyHex: string): string {
  const pB = toBytes(publicKeyHex); const cB = toBytes(process.env.NEXT_PUBLIC_CONTRACT_HEX || "");
  const pfx = toBytes("ff02ffff01"), mid = toBytes("ffff04ffff01b0"), sfx = toBytes("ff018080");
  const fullReveal = new Uint8Array(pfx.length + cB.length + mid.length + pB.length + sfx.length);
  fullReveal.set(pfx, 0); fullReveal.set(cB, pfx.length); fullReveal.set(mid, pfx.length + cB.length); fullReveal.set(pB, pfx.length + cB.length + mid.length); fullReveal.set(sfx, fullReveal.length - sfx.length);
  return "0x" + toHex(clvmTree(parseCLVMBytes(fullReveal).node));
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const publicKeyHex = searchParams.get("publicKeyHex");

  console.log(`\n[CHIA MULTI-INDEX BALANCE] ==========================================`);
  console.log(`[CHIA MULTI-INDEX BALANCE] [START] Инициализация сканирования баланса по пулу индексов`);
  console.log(`[CHIA MULTI-INDEX BALANCE] [INPUT] Входящий Master/Wallet PK Hex: "${publicKeyHex}"`);

  if (!publicKeyHex) {
    return NextResponse.json({ success: false, data: null, error: "publicKeyHex query parameter is required" }, { status: 400 });
  }

  return createApiResponse<FullBalanceResponse>(async () => {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
    const networkFolder = isTestnet ? "testnet11" : "mainnet";
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";

    let sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "full_node");
    let certPath = path.join(sslPath, "private_full_node.crt"), keyPath = path.join(sslPath, "private_full_node.key");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
      certPath = path.join(sslPath, "private_full_node.crt"); keyPath = path.join(sslPath, "private_full_node.key");
    }
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) throw new Error(`SSL-сертификаты Full Node полностью отсутствуют в системе.`);

    const agent = new https.Agent({ cert: fs.readFileSync(path.join(sslPath, "private_full_node.crt")), key: fs.readFileSync(path.join(sslPath, "private_full_node.key")), rejectUnauthorized: false });

    const indexToHashNodeMap = new Map<string, number>();
    const puzzleHashesList: string[] = [];
    const generatedAddressesList: string[] = [];

    // Генерируем 100 хешей контрактов и сразу переводим их в текстовые bech32m адреса Chia
    for (let index = 0; index < 100; index++) {
      const currentIndexPublicKey = publicKeyHex; // Если на бэке будет деривация: toHex(AugSchemeMPL.deriveChildPk(masterPk, index).toBytes())
      const pHash = generateContractPuzzleHash(currentIndexPublicKey);
      const readableAddress = encodePuzzleHashToAddress(pHash, isTestnet);
      
      if (!indexToHashNodeMap.has(pHash)) {
        puzzleHashesList.push(pHash);
        generatedAddressesList.push(readableAddress);
        indexToHashNodeMap.set(pHash, index);
      }
    }

    const rpcPayload = JSON.stringify({ puzzle_hashes: puzzleHashesList, include_spent_coins: false });
    console.log(`[CHIA MULTI-INDEX BALANCE] [RPC REQUEST] POST -> https://localhost:8555/get_coin_records_by_puzzle_hashes (Пул из ${puzzleHashesList.length} хэшей)`);

    const nodeResponseData = await new Promise<ChiaRpcBalanceResult>((resolve, reject) => {
      const req = https.request("https://localhost:8555/get_coin_records_by_puzzle_hashes", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json", "Content-Length": Buffer.byteLength(rpcPayload, "utf8") }, agent, timeout: 15000 }, (res) => {
        const chunks: Buffer[] = []; res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as ChiaRpcBalanceResult); } catch { reject(new Error("Ошибка парсинга ответа ноды")); } });
      });
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout ответа ноды")); });
      req.on("error", (err) => reject(err)); req.write(rpcPayload, "utf8"); req.end();
    });

    if (!nodeResponseData.success) throw new Error(nodeResponseData.error || "Full Node RPC Error");

    const allCoinRecords = nodeResponseData.coin_records || [];
    let totalWalletMojo = 0n;
    
    // Инициализируем структуру ответа для 100 индексов
    const addressesMap = new Map<number, IndexRecord>();
    for (let i = 0; i < 100; i++) {
      addressesMap.set(i, { index: i, puzzle_hash: puzzleHashesList[i] || "", address: generatedAddressesList[i] || "", xch: "0", mojo: "0", coins: [] });
    }

    // Распределяем монеты по индексам
    for (const record of allCoinRecords) {
      if (!record.spent) {
        const coinPuzzleHash = record.coin.puzzle_hash.toLowerCase();
        const index = indexToHashNodeMap.get(coinPuzzleHash) ?? indexToHashNodeMap.get("0x" + coinPuzzleHash);
        
        if (index !== undefined) {
          const targetIndexRecord = addressesMap.get(index)!;
          const coinMojo = BigInt(record.coin.amount);
          
          targetIndexRecord.coins.push(record);
          targetIndexRecord.mojo = (BigInt(targetIndexRecord.mojo) + coinMojo).toString();
          targetIndexRecord.xch = formatMojoToXch(BigInt(targetIndexRecord.mojo));
          
          totalWalletMojo += coinMojo;
        }
      }
    }

    const finalAddressesArray = Array.from(addressesMap.values());
    console.log(`[CHIA MULTI-INDEX BALANCE] [SUCCESS] Общий баланс кошелька по 100 индексам: ${formatMojoToXch(totalWalletMojo)} XCH`);

    return {
      total_xch: formatMojoToXch(totalWalletMojo),
      total_mojo: totalWalletMojo.toString(),
      addresses: finalAddressesArray
    };
  });
}
