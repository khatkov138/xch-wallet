import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os" // Для динамического поиска домашней папки Windows
import { addressToPuzzleHash } from "@/lib/chia-crypto"

// Отключаем панику Node.js из-за самоподписанных SSL-сертификатов локальной ноды Chia
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  console.log(`\n[CHIA BALANCE] === СТАРТ ЗАПРОСА БАЛАНСА ===`)
  console.log(`[CHIA BALANCE] Получен адрес из браузера: "${address}"`)

  // Валидация адреса: разрешаем и xch1, и txch1
  if (!address || (!address.startsWith("xch1") && !address.startsWith("txch1"))) {
    console.log(`[CHIA BALANCE] ОШИБКА: Неверный формат адреса (не xch1 и не txch1)`)
    return NextResponse.json({ error: "Valid Chia address (Mainnet or Testnet) is required" }, { status: 400 })
  }

  try {
    // 1. Динамически определяем путь к домашней папке пользователя (C:\Users\Имя)
    const homeDir = os.homedir()
    
    // 2. Считываем флаг сети из вашего .env.local
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
    
    // 3. Автоматически выбираем нужную папку с актуальными сертификатами
    const networkFolder = isTestnet ? "testnet11" : "mainnet"
    const sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "wallet")

    const certPath = path.join(sslPath, "private_wallet.crt")
    const keyPath = path.join(sslPath, "private_wallet.key")

    console.log(`[CHIA BALANCE] Автоматический выбор mTLS пути: ${sslPath}`)

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.log(`[CHIA BALANCE] ОШИБКА: Сертификаты не найдены по пути ${sslPath}`)
      return NextResponse.json({ error: `SSL-сертификаты отсутствуют по пути: ${sslPath}` }, { status: 500 })
    }

    const cert = fs.readFileSync(certPath)
    const key = fs.readFileSync(keyPath)

    const agent = new https.Agent({ cert, key, rejectUnauthorized: false })

    // Переводим входящий адрес пользователя в хэш
    const pHash = addressToPuzzleHash(address)
    console.log(`[CHIA BALANCE] Сгенерирован Puzzle Hash: ${pHash}`)

    // Родной Payload для Wallet RPC метода get_coin_records
    const rpcPayload = JSON.stringify({
      puzzle_hash: pHash,
      include_spent_coins: false // Нам нужны только живые монеты для вычисления баланса
    })

    console.log(`[CHIA BALANCE] Отправка POST на https://localhost:9256/get_coin_records ...`)

    const nodeResponseData: any = await new Promise((resolve, reject) => {
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
          res.on("data", (chunk) => { chunks += chunk })
          res.on("end", () => {
            try {
              resolve(JSON.parse(chunks))
            } catch (e) {
              reject(new Error(`Критическая ошибка парсинга. Сырой ответ: ${chunks}`))
            }
          })
        }
      )

      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")) })
      req.on("error", (err) => reject(err))
      req.write(rpcPayload, "utf8")
      req.end()
    })

    if (!nodeResponseData.success) {
      console.log(`[CHIA BALANCE] ОШИБКА метода get_coin_records: ${nodeResponseData.error}`)
      return NextResponse.json({ error: nodeResponseData.error || "RPC Error" }, { status: 400 })
    }

    console.log(`[CHIA BALANCE] Ответ ноды успешно получен.`)

    // Считаем сумму непотраченных монет
    const coinRecords = nodeResponseData.coin_records || []
    console.log(`[CHIA BALANCE] Найдено записей монет в локальной базе: ${coinRecords.length}`)

    let totalMojo = 0
    coinRecords.forEach((record: any) => {
      if (!record.spent) {
        totalMojo += Number(record.coin.amount)
      }
    })

    const totalXch = totalMojo / 1_000_000_000_000

    console.log(`[CHIA BALANCE] УСПЕХ -> Баланс посчитан! Mojo: ${totalMojo} | XCH: ${totalXch}`)
    console.log(`[CHIA BALANCE] === КОНЕЦ УСПЕШНОГО ЗАПРОСА ===\n`)

    // ВОЗВРАЩАЕМ УДОБНЫЙ ДЛЯ ФРОНТЕНДА JSON С ПОСЧИТАННЫМ БАЛАНСОМ
    return NextResponse.json({
      success: true,
      xch: totalXch,
      mojo: totalMojo,
      coin_records: coinRecords
    })

  } catch (error: any) {
    console.log(`[CHIA BALANCE] КРИТИЧЕСКИЙ СБОЙ В БЛОКЕ CATCH: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
