import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    // 1. Принимаем публичный ключ от фронтенда
    const { wallet_pk_hex } = await req.json()

    if (!wallet_pk_hex) {
      return NextResponse.json(
        { status: "error", message: "Параметр wallet_pk_hex обязателен" },
        { status: 400 }
      )
    }

    // 2. Путь к питоновскому скрипту от корня проекта
    // Если папка 'crypto' лежит в 'src/crypto', оставляем так. 
    // Если папка 'crypto' лежит прямо в корне рядом с 'src', то убери "src/" из пути ниже.
    const scriptPath = path.resolve(process.cwd(), "src/crypto/get_address.py")

    // 3. Запуск процесса
    const runPython = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const pythonExecutable = process.platform === "win32" ? "py" : "python3"
        const args = process.platform === "win32" ? ["-3.11", scriptPath, wallet_pk_hex] : [scriptPath, wallet_pk_hex]

        execFile(pythonExecutable, args, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Ошибка выполнения скрипта: ${error.message}. Stderr: ${stderr}`))
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
    console.error("[API CHIA ADDRESS ERROR]:", error)
    return NextResponse.json(
      { status: "error", message: error.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
