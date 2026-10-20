import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { addressToPuzzleHash } from "@/lib/chia-crypto"
import { createApiResponse } from "@/lib/server-utils"

// Отключаем панику Node.js из-за самоподписанных SSL-сертификатов локальной ноды Chia
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Интерфейс монеты из RPC ответа Full Node (метод get_coin_records_by_puzzle_hash)
interface ChiaCoinRecord {
  amount: number;
  spent_height: number;
  confirmed_height: number;
  coinbase: boolean;
  id: string; 
  coin: {
    amount: number;
    parent_coin_info: string;
    puzzle_hash: string;
  };
  spent: boolean;
  [key: string]: unknown;
}

// Строгая типизация ответов от самого RPC-сервера Full Node
interface ChiaRpcBalanceSuccess {
  success: true;
  coin_records: ChiaCoinRecord[];
}

interface ChiaRpcBalanceError {
  success: false;
  error: string;
}

type ChiaRpcBalanceResult = ChiaRpcBalanceSuccess | ChiaRpcBalanceError;

// Интерфейс для финальных данных, которые вернутся в поле `data` шаблона createApiResponse
interface BalanceSuccessResponse {
  xch: number;
  mojo: number;
  coin_records: ChiaCoinRecord[];
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  console.log(`\n[CHIA FULL NODE BALANCE] === СТАРТ ЗАПРОСА БАЛАНСА ===`)
  console.log(`[CHIA FULL NODE BALANCE] Получен адрес из браузера: "${address}"`)

  // Первичная базовая валидация адреса перед запуском тяжелой логики
  if (!address || (!address.startsWith("xch1") && !address.startsWith("txch1"))) {
    console.log(`[CHIA FULL NODE BALANCE] ОШИБКА: Неверный формат адреса (не xch1 и не txch1)`)
    return NextResponse.json({
      success: false,
      data: null,
      error: "Valid Chia address (Mainnet or Testnet) is required"
    }, { status: 400 })
  }

  // Обертываем всю внутреннюю логику и mTLS запросы в шаблон createApiResponse
  return createApiResponse<BalanceSuccessResponse>(async () => {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
    const networkFolder = isTestnet ? "testnet11" : "mainnet"
    
    // Кроссплатформенное определение домашней директории для Windows/Linux
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";

    // 1. Попытка загрузить путь на основе текущей активной сети из .env
    let sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "full_node")
    let certPath = path.join(sslPath, "private_full_node.crt")
    let keyPath = path.join(sslPath, "private_full_node.key")

    // 2. УМНЫЙ ФОЛЛБЭК: Если для тестнета нет папки или ключей, забираем рабочие сертификаты из mainnet
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.log(`[CHIA FULL NODE BALANCE] Сертификаты в ${networkFolder} не найдены. Переключаемся на фоллбэк в mainnet...`)
      sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node")
      certPath = path.join(sslPath, "private_full_node.crt")
      keyPath = path.join(sslPath, "private_full_node.key")
    }

    // 3. ЖЕСТКИЙ WINDOWS ФОЛЛБЭК (на случай аномалий с os.homedir)
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`
      certPath = path.join(sslPath, "private_full_node.crt")
      keyPath = path.join(sslPath, "private_full_node.key")
    }

    // Финальная проверка доступности файлов перед mTLS рукопожатием
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`SSL-сертификаты Full Node полностью отсутствуют в системе.`)
    }

    console.log(`[CHIA FULL NODE BALANCE] Успешно инициализированы ключи по пути: ${sslPath}`)

    const cert = fs.readFileSync(certPath)
    const key = fs.readFileSync(keyPath)
    const agent = new https.Agent({ cert, key, rejectUnauthorized: false })

    // Переводим входящий адрес в puzzle hash и гарантируем префикс "0x"
    let pHash = addressToPuzzleHash(address)
    if (!pHash.startsWith("0x")) {
      pHash = "0x" + pHash
    }
    console.log(`[CHIA FULL NODE BALANCE] Сгенерирован Puzzle Hash: ${pHash}`)

    // RPC payload для метода Full Node
    const rpcPayload = JSON.stringify({
      puzzle_hash: pHash,
      include_spent_coins: false // Берем только живые UTXO (unspent)
    })

    console.log(`[CHIA FULL NODE BALANCE] Отправка POST на https://localhost:8555/get_coin_records_by_puzzle_hash ...`)

    // Асинхронный mTLS запрос к Full Node
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
          timeout: 5000
        },
        (res) => {
          console.log(`[CHIA FULL NODE BALANCE] Ответ от Full Node получен. HTTP Статус: ${res.statusCode}`)
          let chunks = ""
          res.on("data", (chunk: string) => { chunks += chunk })
          res.on("end", () => {
            try {
              resolve(JSON.parse(chunks) as ChiaRpcBalanceResult)
            } catch {
              reject(new Error(`Критическая ошибка парсинга JSON ответа Full Node`))
            }
          })
        }
      )

      req.on("timeout", () => { req.destroy(); reject(new Error("Превышено время ожидания ответа от Full Node Chia (Timeout)")) })
      req.on("error", (err: Error) => reject(err))
      req.write(rpcPayload, "utf8")
      req.end()
    })

    // Если нода вернула success: false, выбрасываем ошибку, чтобы её перехватил шаблон createApiResponse
    if (!nodeResponseData.success) {
      console.log(`[CHIA FULL NODE BALANCE] ОШИБКА метода get_coin_records_by_puzzle_hash: ${nodeResponseData.error}`)
      throw new Error(nodeResponseData.error || "Full Node RPC Error")
    }

    console.log(`[CHIA FULL NODE BALANCE] Ответ Full Node успешно получен.`)

    const coinRecords = nodeResponseData.coin_records || []
    console.log(`[CHIA FULL NODE BALANCE] Найдено записей монет в Full Node: ${coinRecords.length}`)

    // Считаем сумму чистых (непотраченных) монет
    let totalMojo = 0
    coinRecords.forEach((record: ChiaCoinRecord) => {
      if (record && !record.spent && record.spent_height === 0) {
        const amount = record.coin?.amount ?? record.amount;
        if (typeof amount === 'number') {
          totalMojo += amount
        }
      }
    })

    const totalXch = totalMojo / 1_000_000_000_000
    console.log(`[CHIA FULL NODE BALANCE] УСПЕХ -> Баланс посчитан через Full Node! Mojo: ${totalMojo} | XCH: ${totalXch}`)
    console.log(`[CHIA FULL NODE BALANCE] === КОНЕЦ УСПЕШНОГО ЗАПРОСА ===\n`)

    // Возвращаем чистый объект для хелпера бэкенда
    return {
      xch: totalXch,
      mojo: totalMojo,
      coin_records: coinRecords
    }
  })
}
