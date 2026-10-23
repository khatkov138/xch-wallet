import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const { 
      wallet_pk_hex,
      target_address,
      amount_mojo,
      fee_mojo,
      my_puzzle_hash_hex,
      signature_hex,
      selected_coins_json // Строка массива монет
    } = await req.json()

    if (!wallet_pk_hex || !target_address || !amount_mojo || !my_puzzle_hash_hex || !signature_hex || !selected_coins_json) {
      return NextResponse.json(
        { status: "error", message: "Не все обязательные параметры переданы для отправки" },
        { status: 400 }
      )
    }

    // Кодируем JSON монет в Base64, чтобы Windows CLI не ломал кавычки внутри аргументов
    const coinsBase64 = Buffer.from(selected_coins_json).toString('base64')

    const scriptPath = path.resolve(process.cwd(), "src/crypto/submit_tx.py")

    const runPython = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const pythonExecutable = process.platform === "win32" ? "py" : "python3"
        
        // Массив аргументов в точности повторяет структуру твоего первого роута
        const args = process.platform === "win32" 
          ? ["-3.11", scriptPath, wallet_pk_hex, target_address, String(amount_mojo), String(fee_mojo || 0), my_puzzle_hash_hex, signature_hex, coinsBase64] 
          : [scriptPath, wallet_pk_hex, target_address, String(amount_mojo), String(fee_mojo || 0), my_puzzle_hash_hex, signature_hex, coinsBase64]

        execFile(pythonExecutable, args, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Ошибка отправки транзакции: ${error.message}. Stderr: ${stderr}`))
            return
          }
          
          try {
            const parsedData = JSON.parse(stdout.trim())
            resolve(parsedData)
          } catch (parseError) {
            reject(new Error(`Питон вернул не JSON. Данные: ${stdout}`))
          }
        })
      })
    }

    const result = await runPython()
    return NextResponse.json(result)

  } catch (error: any) {
    console.error("[API CHIA TX SUBMIT ERROR]:", error)
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 })
  }
}
