import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { bech32m } from "bech32"
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
  timestamp?: number; // Точный timestamp блока из Chia RPC ноды
  coin: {
    amount: number | string;
    parent_coin_info: string;
    puzzle_hash: string;
  };
  [key: string]: unknown;
}

interface ChiaRpcFullNodeResult {
  success: boolean;
  coin_records?: ChiaCoinRecord[];
  error?: string;
}

interface CleanTransaction {
  name: string;
  to_address: string;
  amount: string; 
  confirmed_at_time: number; 
  type: number; 
}

const MOJO_PER_XCH = 1000000000000n;

function formatMojoToXch(mojo: bigint): string {
  const mojoStr = mojo.toString();
  if (mojo === 0n) return "0";
  
  if (mojo < MOJO_PER_XCH) {
    const padded = mojoStr.padStart(12, "0");
    return `0.${padded}`.replace(/\.?0+$/, "");
  }
  
  const integerPart = mojoStr.slice(0, -12);
  const fractionalPart = mojoStr.slice(-12).replace(/0+$/, "");
  
  return fractionalPart.length > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
}

function safeAddressToPuzzleHash(address: string): string {
  const decoded = bech32m.decode(address);
  const words = bech32m.fromWords(decoded.words);
  return Buffer.from(words).toString("hex");
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  console.log(`\n[CHIA FULL NODE TX] ==========================================`)
  console.log(`[CHIA FULL NODE TX] [START] Запрос истории через FULL NODE (Порт 8555)`)

  if (!address || (!address.startsWith("xch1") && !address.startsWith("txch1"))) {
    return NextResponse.json({
      success: false,
      data: null,
      error: "Valid Chia address is required"
    }, { status: 400 })
  }

  return createApiResponse<CleanTransaction[]>(async () => {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
    const networkFolder = isTestnet ? "testnet11" : "mainnet"
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";
    
    let sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "full_node")
    let certPath = path.join(sslPath, "private_full_node.crt")
    let keyPath = path.join(sslPath, "private_full_node.key")

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node")
      certPath = path.join(sslPath, "private_full_node.crt")
      keyPath = path.join(sslPath, "private_full_node.key")
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`
      certPath = path.join(sslPath, "private_full_node.crt")
      keyPath = path.join(sslPath, "private_full_node.key")
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`SSL-сертификаты Full Node полностью отсутствуют в системе.`)
    }

    const cert = fs.readFileSync(certPath)
    const key = fs.readFileSync(keyPath)
    const agent = new https.Agent({ cert, key, rejectUnauthorized: false })

    let pHash = safeAddressToPuzzleHash(address)
    if (!pHash.startsWith("0x")) pHash = "0x" + pHash

    const rpcPayload = JSON.stringify({
      puzzle_hash: pHash,
      include_spent_coins: true 
    })

    const nodeResponseData = await new Promise<ChiaRpcFullNodeResult>((resolve, reject) => {
      const req = https.request(
        "https://localhost:8555/get_coin_records_by_puzzle_hash",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Content-Length": Buffer.byteLength(rpcPayload, "utf8")
          },
          agent: agent,
          timeout: 15000
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => { chunks.push(chunk) })
          res.on("end", () => {
            try {
              const completeBuffer = Buffer.concat(chunks)
              resolve(JSON.parse(completeBuffer.toString("utf8")) as ChiaRpcFullNodeResult)
            } catch {
              reject(new Error(`Ошибка парсинга JSON ответа Full Node`))
            }
          })
        }
      )
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")) })
      req.on("error", (err: Error) => reject(err))
      req.write(rpcPayload, "utf8")
      req.end()
    })

    if (!nodeResponseData.success) {
      throw new Error(nodeResponseData.error || "Full Node RPC Error")
    }

    const coinRecords = nodeResponseData.coin_records || []
    const SECONDS_PER_BLOCK = 18.75 
    const finalHistory: CleanTransaction[] = [];

    for (const record of coinRecords) {
      if (!record.coin) continue;

      const amountMojo = BigInt(record.coin.amount);
      const amountXch = formatMojoToXch(amountMojo);
      const fallbackCoinId = record.id || `${record.coin.parent_coin_info.slice(0, 10)}_${record.coin.amount}`;

      const cHeight = record.confirmed_block_index ?? record.confirmed_height ?? 0;
      const sHeight = record.spent_block_index ?? record.spent_height ?? 0;
      
      // Опорный стабильный timestamp из ноды (дефолт на случай, если блок совсем свежий)
      const baseTimestamp = record.timestamp ?? Math.floor(Date.now() / 1000);

      // 1. Расчет времени для входящей транзакции (создание монеты)
      let cTimestamp = baseTimestamp;
      if (record.spent && sHeight > cHeight) {
        // Если монета уже потрачена, нода возвращает timestamp траты.
        // Чтобы узнать время создания, отматываем секунды назад на основе разницы блоков.
        cTimestamp = baseTimestamp - Math.floor((sHeight - cHeight) * SECONDS_PER_BLOCK);
      } else if (!record.spent && cHeight > 0) {
        // Если монета не потрачена, возвращаемый timestamp — это и есть время её создания.
        cTimestamp = baseTimestamp;
      }

      finalHistory.push({
        name: fallbackCoinId,
        to_address: address,
        amount: amountXch,
        confirmed_at_time: cTimestamp,
        type: 1 
      });

      // 2. Расчет времени для исходящей транзакции (трата монеты)
      if (record.spent) {
        // Для потраченной монеты record.timestamp из ноды — это точнейшее время совершения транзакции.
        finalHistory.push({
          name: fallbackCoinId,
          to_address: address,
          amount: amountXch,
          confirmed_at_time: baseTimestamp,
          type: 2 
        });
      }
    }

    finalHistory.sort((a, b) => b.confirmed_at_time - a.confirmed_at_time)
    console.log(`[CHIA FULL NODE TX] УСПЕХ -> Отдано транзакций на фронтенд: ${finalHistory.length}`)
    return finalHistory
  })
}
