import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { createApiResponse } from "@/lib/server-utils"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface ChiaRpcSendTransactionResult {
  success: boolean;
  transaction?: {
    confirmed: boolean;
    name: string;
    amount: number | string;
    spend_bundle?: any;
  };
  error?: string;
}

interface FullNodePushTxResult {
  success: boolean;
  status: string;
  error?: string;
}

const MOJO_PER_XCH = 1000000000000n;

const WALLET_DATA = {
  fingerprint: 403921831,
  address: "txch10jfgrn26fzdwcakzq8rs9cmhh3lzz9ctgp9dq82hrt5rg6djmfhqku7rmg"
};

/**
 * Высокоточная генерация случайной суммы в диапазоне [min, max]
 */
function generateRandomMojoAmount(min: number, max: number): { xch: string; mojo: bigint } {
  const randomXch = Math.random() * (max - min) + min;
  const xchStr = randomXch.toFixed(12);

  const [integerPart, fractionalPart = ""] = xchStr.split(".");
  const paddedFraction = fractionalPart.padEnd(12, "0").slice(0, 12);

  const mojo = BigInt(integerPart) * MOJO_PER_XCH + BigInt(paddedFraction);

  return { xch: xchStr, mojo };
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const forceUpdate = searchParams.get("_t") || Date.now().toString();

  console.log(`\n[CHIA DEBUG PIPELINE] ==========================================`)
  console.log(`[CHIA DEBUG PIPELINE] [START] Рандомный amount от 0.011111 до 0.022222. Запрос: ${forceUpdate}`)

  return createApiResponse<any>(async () => {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
    const networkFolder = isTestnet ? "testnet11" : "mainnet"
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";

    // 1. Настройка SSL для кошелька (Порт 9256)
    let walletSslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "wallet")
    let walletCert = path.join(walletSslPath, "private_wallet.crt")
    let walletKey = path.join(walletSslPath, "private_wallet.key")

    if (!fs.existsSync(walletCert)) {
      walletSslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\wallet`
      walletCert = path.join(walletSslPath, "private_wallet.crt")
      walletKey = path.join(walletSslPath, "private_wallet.key")
    }

    // 2. Настройка SSL для Full Node (Порт 8555) — подтягивается заранее
    let nodeSslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "full_node")
    let nodeCert = path.join(nodeSslPath, "private_full_node.crt")
    let nodeKey = path.join(nodeSslPath, "private_full_node.key")

    if (!fs.existsSync(nodeCert)) {
      nodeSslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`
      nodeCert = path.join(nodeSslPath, "private_full_node.crt")
      nodeKey = path.join(nodeSslPath, "private_full_node.key")
    }

    if (!fs.existsSync(walletCert) || !fs.existsSync(nodeCert)) {
      throw new Error(`SSL-сертификаты (кошелька или ноды) отсутствуют в системе.`)
    }

    const walletAgent = new https.Agent({ cert: fs.readFileSync(walletCert), key: fs.readFileSync(walletKey), rejectUnauthorized: false })
    const nodeAgent = new https.Agent({ cert: fs.readFileSync(nodeCert), key: fs.readFileSync(nodeKey), rejectUnauthorized: false })

    // Генерируем случайную сумму строго в диапазоне от 0.011111 до 0.022222 XCH
    const { mojo: randomMojo } = generateRandomMojoAmount(0.011111, 0.022222);

    // Стабильная фиксированная комиссия (0.0001 TXCH)
    const stableFee = 100000000;

    // Логин в кошелек
    const logInPayload = JSON.stringify({ fingerprint: WALLET_DATA.fingerprint })
    await new Promise<void>((resolve) => {
      const req = https.request("https://localhost:9256/log_in", { method: "POST", headers: { "Content-Type": "application/json" }, agent: walletAgent, timeout: 5000 }, (res) => {
        res.on("data", () => { })
        res.on("end", () => resolve())
      })
      req.on("error", () => resolve())
      req.write(logInPayload)
      req.end()
    })

    // Запрос бандла у кошелька с рандомным amount и стабильным fee
    const walletPayload = JSON.stringify({
      wallet_id: 1,
      address: WALLET_DATA.address,
      amount: Number(randomMojo),
      fee: stableFee,
      push: false // Безопасный режим дебага
    })

    const walletResponseData = await new Promise<ChiaRpcSendTransactionResult>((resolve, reject) => {
      const req = https.request(
        "https://localhost:9256/send_transaction",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          agent: walletAgent,
          timeout: 15000
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => chunks.push(chunk))
          res.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as ChiaRpcSendTransactionResult)
            } catch {
              reject(new Error("Ошибка парсинга JSON ответа от Wallet RPC"))
            }
          })
        }
      )
      req.on("error", reject)
      req.write(walletPayload)
      req.end()
    })

    if (!walletResponseData.success || !walletResponseData.transaction?.spend_bundle) {
      throw new Error(walletResponseData.error || "Не удалось перехватить SpendBundle.")
    }

    const targetSpendBundle = walletResponseData.transaction.spend_bundle;
    console.log(`[CHIA DEBUG PIPELINE] [WALLET SUCCESS] Уникальный SpendBundle успешно перехвачен.`)

    // -------------------------------------------------------------------------
    // ШАГ ДЛЯ ПРОВЕРКИ: ОТПРАВКА БАНДЛА НАПРЯМУЮ В FULL NODE RPC (ЗАКОММЕНТИРОВАНО)
    // -------------------------------------------------------------------------

    const nodePayload = JSON.stringify({ spend_bundle: targetSpendBundle })
    console.log(`[CHIA DEBUG PIPELINE] [FULL NODE] Отправка бандла на https://localhost:8555/push_tx`)

    const nodeResponseData = await new Promise<FullNodePushTxResult>((resolve, reject) => {
      const req = https.request(
        "https://localhost:8555/push_tx",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(nodePayload, "utf8")
          },
          agent: nodeAgent,
          timeout: 15000
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => chunks.push(chunk))
          res.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as FullNodePushTxResult)
            } catch {
              reject(new Error("Не удалось распарсить ответ от Full Node RPC"))
            }
          })
        }
      )
      req.on("error", reject)
      req.write(nodePayload)
      req.end()
    })

    console.log(`[CHIA DEBUG PIPELINE] [FULL NODE RESPONSE]`, nodeResponseData)
    // Если захочешь вернуть ответ ноды вместо голого бандла, раскомментируй строку ниже:
    return nodeResponseData;


    // Выплёвываем ТОЛЬКО чистый spend_bundle
    return targetSpendBundle;
  })
}
