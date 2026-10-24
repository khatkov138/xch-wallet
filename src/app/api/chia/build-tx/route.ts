import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const { 
      unhardened_sk,    // Локально деривированный приватный ключ кошелька
      target_address,   // Адрес получателя, куда отправляем
      amount_mojo,      // Сумма в mojo
      fee_mojo,
      network = "testnet11"
    } = await req.json()

    if (!unhardened_sk || !target_address || !amount_mojo) {
      return NextResponse.json(
        { status: "error", message: "Не все обязательные параметры переданы (unhardened_sk, target_address, amount_mojo)" },
        { status: 400 }
      )
    }

    const scriptPath = path.resolve(process.cwd(), "src/crypto/build_tx.py")

    const runPython = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const pythonExecutable = process.platform === "win32" ? "py" : "python3"
        
        // БЕЗОПАСНО: В аргументы передаем ТОЛЬКО флаги и путь к скрипту. Ключи не светятся в процессах ОС!
        const args = process.platform === "win32" 
          ? ["-3.11", scriptPath] 
          : [scriptPath]

        const child = execFile(pythonExecutable, args, (error, stdout, stderr) => {
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

        // ИСПРАВЛЕНО: Безопасно пишем все данные, включая приватный ключ, напрямую в поток stdin питона
        const payload = JSON.stringify({
          unhardened_sk,
          target_address,
          amount_mojo,
          fee_mojo: fee_mojo || 0,
          network
        })

        child.stdin?.write(payload)
        child.stdin?.end()
      })
    }

    const result = await runPython()
    return NextResponse.json(result)

  } catch (error: any) {
    console.error("[API CHIA TX CREATE ERROR]:", error)
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 })
  }
}
