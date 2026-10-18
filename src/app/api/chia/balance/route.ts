import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { addressToPuzzleHash } from "@/lib/chia-crypto"
import { createApiResponse } from "@/lib/server-utils"

// Отключаем панику Node.js из-за самоподписанных SSL-сертификатов локальной ноды Chia
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Интерфейс монеты из RPC ответа Chia (метод get_coin_records возвращает именно такую плоскую структуру)
interface ChiaCoinRecord {
  amount: number;
  spent_height: number;
  confirmed_height: number;
  coinbase: boolean;
  id: string;
  parent_coin_info: string;
  puzzle_hash: string;
  spent_height_or_zero?: number; // На случай разных версий ноды
  [key: string]: unknown;
}

// Строгая типизация ответов от самого RPC-сервера Chia
interface ChiaRpcBalanceSuccess {
  success: true;
  coin_records: ChiaCoinRecord[];
}

interface ChiaRpcBalanceError {
  success: false;
  error: string;
}

type ChiaRpcBalanceResult = ChiaRpcBalanceSuccess | ChiaRpcBalanceError;

// Интерфейс для финальных данных, которые вернутся в поле `data` твоего шаблона createApiResponse
interface BalanceSuccessResponse {
  xch: number;
  mojo: number;
  coin_records: ChiaCoinRecord[];
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  console.log(`\n[CHIA BALANCE] === СТАРТ ЗАПРОСА БАЛАНСА ===`)
  console.log(`[CHIA BALANCE] Получен адрес из браузера: "${address}"`)

  // Первичная базовая валидация адреса перед запуском тяжелой логики
  if (!address || (!address.startsWith("xch1") && !address.startsWith("txch1"))) {
    console.log(`[CHIA BALANCE] ОШИБКА: Неверный формат адреса (не xch1 и не txch1)`)
    return NextResponse.json({
      success: false,
      data: null,
      error: "Valid Chia address (Mainnet or Testnet) is required"
    }, { status: 400 })
  }

  // Обертываем всю внутреннюю логику и mTLS запросы в твой фирменный шаблон
  return createApiResponse<BalanceSuccessResponse>(async () => {
    const homeDir = os.homedir()
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
    const networkFolder = isTestnet ? "testnet11" : "mainnet"
    const sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "wallet")

    const certPath = path.join(sslPath, "private_wallet.crt")
    const keyPath = path.join(sslPath, "private_wallet.key")

    console.log(`[CHIA BALANCE] Автоматический выбор mTLS пути: ${sslPath}`)

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`SSL-сертификаты отсутствуют по пути: ${sslPath}`)
    }

    const cert = fs.readFileSync(certPath)
    const key = fs.readFileSync(keyPath)
    const agent = new https.Agent({ cert, key, rejectUnauthorized: false })

    // Переводим входящий адрес в puzzle hash и гарантируем префикс "0x"
    let pHash = addressToPuzzleHash(address)
    if (!pHash.startsWith("0x")) {
      pHash = "0x" + pHash
    }
    console.log(`[CHIA BALANCE] Сгенерирован Puzzle Hash: ${pHash}`)

    const rpcPayload = JSON.stringify({
      puzzle_hash: pHash,
      include_spent_coins: false // Берем только живые UTXO
    })

    console.log(`[CHIA BALANCE] Отправка POST на https://localhost:9256/get_coin_records ...`)

    // Асинхронный mTLS запрос к ноде без any
    const nodeResponseData = await new Promise<ChiaRpcBalanceResult>((resolve, reject) => {
      const req = https.request(
        "https://localhost:9256/get_coin_records",
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
          console.log(`[CHIA BALANCE] Ответ от ноды получен. HTTP Статус: ${res.statusCode}`)
          let chunks = ""
          res.on("data", (chunk: string) => { chunks += chunk })
          res.on("end", () => {
            try {
              resolve(JSON.parse(chunks) as ChiaRpcBalanceResult)
            } catch {
              reject(new Error(`Критическая ошибка парсинга JSON ответа ноды`))
            }
          })
        }
      )

      req.on("timeout", () => { req.destroy(); reject(new Error("Превышено время ожидания ответа от ноды Chia (Timeout)")) })
      req.on("error", (err: Error) => reject(err))
      req.write(rpcPayload, "utf8")
      req.end()
    })

    // Если нода вернула success: false, выбрасываем ошибку, чтобы её перехватил твой шаблон
    if (!nodeResponseData.success) {
      console.log(`[CHIA BALANCE] ОШИБКА метода get_coin_records: ${nodeResponseData.error}`)
      throw new Error(nodeResponseData.error || "RPC Error")
    }

    console.log(`[CHIA BALANCE] Ответ ноды успешно получен.`)

    const coinRecords = nodeResponseData.coin_records || []
    console.log(`[CHIA BALANCE] Найдено записей монет в локальной базе: ${coinRecords.length}`)

    // Считаем сумму чистых монет
    let totalMojo = 0
    coinRecords.forEach((record: ChiaCoinRecord) => {
      if (record && record.spent_height === 0 && typeof record.amount === 'number') {
        totalMojo += record.amount
      }
    })

    const totalXch = totalMojo / 1_000_000_000_000
    console.log(`[CHIA BALANCE] УСПЕХ -> Баланс посчитан! Mojo: ${totalMojo} | XCH: ${totalXch}`)
    console.log(`[CHIA BALANCE] === КОНЕЦ УСПЕШНОГО ЗАПРОСА ===\n`)

    // Возвращаем чистый объект. Твой шаблон сам обернет его в { success: true, data: result, error: null }
    return {
      xch: totalXch,
      mojo: totalMojo,
      coin_records: coinRecords
    }
  })
}
