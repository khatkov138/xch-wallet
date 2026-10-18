import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { createApiResponse } from "@/lib/server-utils"

// Отключаем панику Node.js из-за самоподписанных SSL-сертификатов локальной ноды Chia
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// 1. Интерфейс сырого ответа транзакции от легкого кошелька Chia RPC
interface ChiaRpcTransaction {
  to_address: string;
  amount: number;
  created_at_time: number; // Реальное поле времени легкого кошелька
  type: number;            // 0 = входящая транзакция в экосистеме Chia
  name: string;
  confirmed: boolean;
  [key: string]: unknown;
}

interface ChiaRpcTxSuccess { success: true; transactions: ChiaRpcTransaction[]; }
interface ChiaRpcTxError { success: false; error: string; }
type ChiaRpcTxResult = ChiaRpcTxSuccess | ChiaRpcTxError;

// 2. Чистый тип данных, который мы отдаем на фронтенд (без лишнего мусора ноды)
interface CleanTransaction {
  name: string;
  to_address: string;
  amount: number;
  confirmed_at_time: number;
  type: number;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  console.log(`\n[CHIA TX] === СТАРТ ЗАПРОСА ИСТОРИИ ТРАНЗАКЦИЙ ===`)
  console.log(`[CHIA TX] Получен адрес из браузера для фильтрации: "${address}"`)

  if (!address || (!address.startsWith("xch1") && !address.startsWith("txch1"))) {
    console.log(`[CHIA TX] ОШИБКА: Неверный формат адреса`)
    return NextResponse.json({
      success: false,
      data: null,
      error: "Valid Chia address (Mainnet or Testnet) is required"
    }, { status: 400 })
  }

  // Передаем <CleanTransaction[]> в дженерик, чтобы зафиксировать форму ответа
  return createApiResponse<CleanTransaction[]>(async () => {
    const homeDir = os.homedir()
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
    const networkFolder = isTestnet ? "testnet11" : "mainnet"
    const sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "wallet")

    const certPath = path.join(sslPath, "private_wallet.crt")
    const keyPath = path.join(sslPath, "private_wallet.key")

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`SSL-сертификаты отсутствуют по пути: ${sslPath}`)
    }

    const cert = fs.readFileSync(certPath)
    const key = fs.readFileSync(keyPath)
    const agent = new https.Agent({ cert, key, rejectUnauthorized: false })

    // payload без конфликтного ключа sort_key, вызывавшего ошибку "no known sort"
    const rpcPayload = JSON.stringify({
      wallet_id: 1,
      start: 0,
      end: 50,
      reverse: true
    })

    const nodeResponseData = await new Promise<ChiaRpcTxResult>((resolve, reject) => {
      const req = https.request(
        "https://localhost:9256/get_transactions",
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
          let chunks = ""
          res.on("data", (chunk: string) => { chunks += chunk })
          res.on("end", () => {
            try {
              resolve(JSON.parse(chunks) as ChiaRpcTxResult)
            } catch {
              reject(new Error(`Критическая ошибка парсинга JSON ответа ноды`))
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
      throw new Error(nodeResponseData.error || "RPC Error")
    }

    const rawTransactions = nodeResponseData.transactions || []
    console.log(`[CHIA TX] Всего получено записей из RPC кошелька: ${rawTransactions.length}`)

    // Адаптируем данные под структуру фронтенда и правила ActivityList
    const filteredTx: CleanTransaction[] = rawTransactions
      .filter((tx: ChiaRpcTransaction) => {
        // Проверяем, что транзакция подтверждена и имеет метку времени легкого кошелька
        return tx && tx.confirmed && tx.created_at_time > 0
      })
      .map((tx: ChiaRpcTransaction) => {
        // Конвертируем тип: у кошелька Chia входящий платеж — это type: 0.
        // Превращаем его в 1, чтобы фронтенд зажег зеленую стрелочку получения.
        const frontendType = tx.type === 0 ? 1 : 2

        return {
          name: tx.name,
          to_address: tx.to_address,
          amount: tx.amount,
          confirmed_at_time: tx.created_at_time, // Передаем таймстамп из корректного поля
          type: frontendType
        }
      })

    console.log(`[CHIA TX] УСПЕХ -> Транзакций отдано для фронтенда: ${filteredTx.length}`)
    console.log(`[CHIA TX] === КОНЕЦ УСПЕШНОГО ЗАПРОСА ===\n`)

    return filteredTx
  })
}
