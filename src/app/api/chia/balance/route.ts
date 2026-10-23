import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
// Импортируем стандартный bech32м, чтобы не тащить костыли из старой chia-crypto
import { bech32m } from "bech32"
import { createApiResponse } from "@/lib/server-utils"

// Отключаем панику Node.js из-за самоподписанных SSL-сертификатов локальной ноды Chia
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface ChiaCoinRecord {
  amount: number | string;
  spent_height?: number;
  confirmed_height?: number;
  coinbase: boolean;
  id: string; 
  coin: {
    amount: number | string;
    parent_coin_info: string;
    puzzle_hash: string;
  };
  spent: boolean;
  [key: string]: unknown;
}

interface ChiaRpcBalanceSuccess {
  success: true;
  coin_records: ChiaCoinRecord[];
}

interface ChiaRpcBalanceError {
  success: false;
  error: string;
}

type ChiaRpcBalanceResult = ChiaRpcBalanceSuccess | ChiaRpcBalanceError;

interface BalanceSuccessResponse {
  xch: string;
  mojo: string;
  coin_records: ChiaCoinRecord[];
}

const MOJO_PER_XCH = 1000000000000n;

/**
 * Конвертирует BigInt Mojo в строковое представление XCH без потери точности float
 */
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

/**
 * НАИБОЛЕЕ НАДЕЖНЫЙ ПЕРЕВОД АДРЕСА XCH В PUZZLE HASH НА ЧИСТОМ JS
 */
function safeAddressToPuzzleHash(address: string): string {
  const decoded = bech32m.decode(address);
  const words = bech32m.fromWords(decoded.words);
  return Buffer.from(words).toString("hex");
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  console.log(`\n[CHIA FULL NODE BALANCE] ==========================================`)
  console.log(`[CHIA FULL NODE BALANCE] [START] Инициализация запроса баланса`)
  console.log(`[CHIA FULL NODE BALANCE] [INPUT] Входящий адрес: "${address}"`)

  if (!address || (!address.startsWith("xch1") && !address.startsWith("txch1"))) {
    console.log(`[CHIA FULL NODE BALANCE] [VALIDATION ERROR] Неверный формат адреса: "${address}"`)
    return NextResponse.json({
      success: false,
      data: null,
      error: "Valid Chia address (xch1... or txch1...) is required"
    }, { status: 400 })
  }

  return createApiResponse<BalanceSuccessResponse>(async () => {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
    const networkFolder = isTestnet ? "testnet11" : "mainnet"
    
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";
    console.log(`[CHIA FULL NODE BALANCE] [ENV] Домашний каталог системы: ${homeDir}`)

    let sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "full_node")
    let certPath = path.join(sslPath, "private_full_node.crt")
    let keyPath = path.join(sslPath, "private_full_node.key")

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.log(`[CHIA FULL NODE BALANCE] [CERT WARN] Сертификаты в ${networkFolder} отсутствуют. Пробуем фоллбэк в mainnet...`)
      sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node")
      certPath = path.join(sslPath, "private_full_node.crt")
      keyPath = path.join(sslPath, "private_full_node.key")
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.log(`[CHIA FULL NODE BALANCE] [CERT WARN] Стандартные пути не сработали. Жесткий фоллбэк на аккаунт khatk...`)
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`
      certPath = path.join(sslPath, "private_full_node.crt")
      keyPath = path.join(sslPath, "private_full_node.key")
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.error(`[CHIA FULL NODE BALANCE] [CRITICAL ERROR] SSL сертификаты ноды Chia не обнаружены в системе.`)
      throw new Error(`SSL-сертификаты Full Node полностью отсутствуют в системе. Проверьте установку Chia Network.`)
    }

    console.log(`[CHIA FULL NODE BALANCE] [CERT SUCCESS] Использованы сертификаты: ${sslPath}`)

    const cert = fs.readFileSync(certPath)
    const key = fs.readFileSync(keyPath)
    const agent = new https.Agent({ cert, key, rejectUnauthorized: false })

    // Чистый перевод адреса в пазл-хэш через нативный bech32m без левых библиотек
    let pHash = safeAddressToPuzzleHash(address)
    if (!pHash.startsWith("0x")) {
      pHash = "0x" + pHash
    }
    console.log(`[CHIA FULL NODE BALANCE] [CRYPTO] Преобразован Puzzle Hash: ${pHash}`)

    const rpcPayload = JSON.stringify({
      puzzle_hash: pHash,
      include_spent_coins: false
    })

    console.log(`[CHIA FULL NODE BALANCE] [RPC REQUEST] POST -> https://localhost:8555/get_coin_records_by_puzzle_hash`)

    const nodeResponseData = await new Promise<ChiaRpcBalanceResult>((resolve, reject) => {
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
          timeout: 10000
        },
        (res) => {
          console.log(`[CHIA FULL NODE BALANCE] [RPC RESPONSE] HTTP Статус: ${res.statusCode}`)
          
          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => { chunks.push(chunk) })
          res.on("end", () => {
            try {
              const completeBuffer = Buffer.concat(chunks)
              const parsed = JSON.parse(completeBuffer.toString("utf8")) as ChiaRpcBalanceResult
              resolve(parsed)
            } catch (parseError) {
              console.error(`[CHIA FULL NODE BALANCE] [PARSE ERROR] Не удалось распарсить JSON ответ от ноды`)
              reject(new Error(`Критическая ошибка парсинга JSON ответа Full Node`))
            }
          })
        }
      )

      req.on("timeout", () => { 
        req.destroy()
        reject(new Error("Превышено время ожидания ответа от Full Node Chia (Timeout)")) 
      })
      
      req.on("error", (err: Error) => {
        console.error(`[CHIA FULL NODE BALANCE] [NET ERROR] Ошибка сокета mTLS:`, err.message)
        reject(err)
      })
      
      req.write(rpcPayload, "utf8")
      req.end()
    })

    if (!nodeResponseData.success) {
      console.error(`[CHIA FULL NODE BALANCE] [RPC ERROR] Ошибка метода: ${nodeResponseData.error}`)
      throw new Error(nodeResponseData.error || "Full Node RPC Internal Error")
    }

    const coinRecords = nodeResponseData.coin_records || []
    console.log(`[CHIA FULL NODE BALANCE] [DATA] Всего записей монет пришло из ноды: ${coinRecords.length}`)

    // Высокоточное суммирование непотраченных UTXO
    let totalMojo = 0n
    const unspentCoins: ChiaCoinRecord[] = []

    for (const record of coinRecords) {
      if (!record.spent) {
        totalMojo += BigInt(record.coin.amount)
        unspentCoins.push(record)
      }
    }

    const formattedXch = formatMojoToXch(totalMojo)
    console.log(`[CHIA FULL NODE BALANCE] [SUCCESS] Баланс: ${formattedXch} XCH (${totalMojo.toString()} mojo)`)

    return {
      xch: formattedXch,
      mojo: totalMojo.toString(),
      coin_records: unspentCoins
    }
  })
}
