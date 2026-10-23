import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const { 
      wallet_pk_hex, 
      my_puzzle_hash_hex, 
      target_address, // Строка вида txch1...
      amount_mojo, 
      fee_mojo 
    } = await req.json()

    if (!wallet_pk_hex || !my_puzzle_hash_hex || !target_address || !amount_mojo) {
      return NextResponse.json(
        { status: "error", message: "Не все обязательные параметры переданы" },
        { status: 400 }
      )
    }

    const scriptPath = path.resolve(process.cwd(), "src/crypto/create_unsigned_tx.py")

    const runPython = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const pythonExecutable = process.platform === "win32" ? "py" : "python3"
        
        // Передаем аргументы ровно как они пришли, строку адреса кидаем как есть
        const args = process.platform === "win32" 
          ? ["-3.11", scriptPath, wallet_pk_hex, my_puzzle_hash_hex, target_address, String(amount_mojo), String(fee_mojo || 0)] 
          : [scriptPath, wallet_pk_hex, my_puzzle_hash_hex, target_address, String(amount_mojo), String(fee_mojo || 0)]

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
