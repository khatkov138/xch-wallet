import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    // 1. Принимаем параметры для сборки транзакции с фронтенда
    const { 
      wallet_pk_hex, 
      puzzle_hash_hex, 
      target_puzzle_hash_hex, 
      amount_mojo, 
      fee_mojo 
    } = await req.json()

    // Проверяем обязательные поля
    if (!wallet_pk_hex || !puzzle_hash_hex || !target_puzzle_hash_hex || !amount_mojo) {
      return NextResponse.json(
        { status: "error", message: "Не все обязательные параметры переданы" },
        { status: 400 }
      )
    }

    // 2. Путь к питоновскому скрипту от корня проекта
    const scriptPath = path.resolve(process.cwd(), "src/crypto/create_unsigned_tx.py")

    // 3. Запуск процесса (строго твоя рабочая схема для Windows и Linux)
    const runPython = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const pythonExecutable = process.platform === "win32" ? "py" : "python3"
        const args = process.platform === "win32" 
          ? ["-3.11", scriptPath, wallet_pk_hex, puzzle_hash_hex, target_puzzle_hash_hex, String(amount_mojo), String(fee_mojo || 0)] 
          : [scriptPath, wallet_pk_hex, puzzle_hash_hex, target_puzzle_hash_hex, String(amount_mojo), String(fee_mojo || 0)]

        execFile(pythonExecutable, args, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Ошибка сборки транзакции: ${error.message}. Stderr: ${stderr}`))
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
    console.error("[API CHIA TX CREATE ERROR]:", error)
    return NextResponse.json(
      { status: "error", message: error.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
