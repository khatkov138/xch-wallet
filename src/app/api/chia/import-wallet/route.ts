import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { createApiResponse } from "@/lib/server-utils"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface ChiaRpcAddKeyResult {
  success: boolean;
  fingerprint?: number;
  error?: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const masterPublicKey = searchParams.get("key")

  console.log(`\n[CHIA LIGHT IMPORT] === РЕГИСТРАЦИЯ OBSERVER КЛЮЧА ===`)
  console.log(`[CHIA LIGHT IMPORT] Ключ от фронта: "${masterPublicKey}"`)

  if (!masterPublicKey || masterPublicKey.length !== 96) {
    return NextResponse.json({
      success: false,
      data: null,
      error: "Valid 96-character Master Public Key hex is required"
    }, { status: 400 })
  }

  return createApiResponse<{ fingerprint: number }>(async () => {
    const homeDir = os.homedir()
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
    const networkFolder = isTestnet ? "testnet11" : "mainnet"
    
    const sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "wallet")
    const cert = fs.readFileSync(path.join(sslPath, "private_wallet.crt"))
    const key = fs.readFileSync(path.join(sslPath, "private_wallet.key"))
    const agent = new https.Agent({ cert, key, rejectUnauthorized: false })

    // ОФИЦИАЛЬНЫЙ ЖЕСТКИЙ ФИКС PAYLOAD ПОД PYTHON-КЛАСС ADD_KEY:
    // Очищаем от 0x, если он случайно закрался, поле строго public_key!
    const cleanKey = masterPublicKey.replace(/^0x/i, "")

    const rpcPayload = JSON.stringify({ 
      public_key: cleanKey 
    })

    console.log(`[CHIA LIGHT IMPORT] Отправка POST на порт кошелька 9256/add_key ...`)
    console.log(`[CHIA LIGHT IMPORT] Payload: ${rpcPayload}`)

    return new Promise<{ fingerprint: number }>((resolve, reject) => {
      const req = https.request(
        "https://localhost:9256/add_key", 
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Content-Length": Buffer.byteLength(rpcPayload, "utf8")
          },
          agent: agent,
          timeout: 7000
        },
        (res) => {
          res.setEncoding("utf8")
          let chunks = ""

          res.on("data", (chunk: string) => { chunks += chunk })

          res.on("end", () => {
            console.log(`\n==================================================`)
            console.log(`[CHIA LIGHT IMPORT] ОТВЕТ WALLET RPC (res):`)
            console.log(chunks)
            console.log(`==================================================\n`)

            try {
              const parsed = JSON.parse(chunks)
              
              if (!parsed.success) {
                return reject(new Error(`Ошибка внутри RPC Chia: ${parsed.error}`))
              }
              
              const fingerprint = parsed.fingerprint ?? 0
              console.log(`[CHIA LIGHT IMPORT] УСПЕХ -> Ключ добавлен! Fingerprint: ${fingerprint}`)
              resolve({ fingerprint })

            } catch (e) {
              reject(new Error(`Ошибка парсинга JSON: ${chunks.slice(0, 60)}`))
            }
          })
        }
      )

      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout Wallet RPC")) })
      req.on("error", (err: Error) => reject(err))

      req.write(rpcPayload, "utf8")
      req.end()
    })
  })
}
