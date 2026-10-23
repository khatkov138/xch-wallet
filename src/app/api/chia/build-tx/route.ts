import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const { 
      sender_address,   // Адрес отправителя (твоего кошелька), берем из Zustand стора
      target_address,   // Адрес получателя, куда отправляем
      amount_mojo,      // Сумма в mojo
      fee_mojo 
    } = await req.json()

    // Проверяем только критичные данные, которые вводит пользователь
    if (!sender_address || !target_address || !amount_mojo) {
      return NextResponse.json(
        { status: "error", message: "Не все обязательные параметры переданы (sender_address, target_address, amount_mojo)" },
        { status: 400 }
      )
    }

    const scriptPath = path.resolve(process.cwd(), "src/crypto/create_unsigned_tx.py")

    const runPython = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const pythonExecutable = process.platform === "win32" ? "py" : "python3"
        
        // Передаем питону только чистые адреса и суммы. 
        // Питон сам по адресу найдет монеты в блокчейне и рассчитает puzzle_hash!
        const args = process.platform === "win32" 
          ? ["-3.11", scriptPath, sender_address, target_address, String(amount_mojo), String(fee_mojo || 0)] 
          : [scriptPath, sender_address, target_address, String(amount_mojo), String(fee_mojo || 0)]

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
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 })
  }
}
