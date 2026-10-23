import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const { tx_data, signature } = await req.json()

    if (!tx_data || !signature) {
      return NextResponse.json(
        { status: "error", message: "Отсутствуют необходимые данные (tx_data или signature)" },
        { status: 400 }
      )
    }

    const scriptPath = path.resolve(process.cwd(), "src/crypto/push_signed_tx.py")

    const runPython = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const pythonExecutable = process.platform === "win32" ? "py" : "python3"
        
        // Аргументы командной строки больше НЕ передают тяжелый JSON!
        // Передаем только путь к скрипту. Все данные потекут через stdin.
        const args = process.platform === "win32" ? ["-3.11", scriptPath] : [scriptPath]

        const child = execFile(pythonExecutable, args, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Ошибка push_tx: ${error.message}. Stderr: ${stderr}`))
            return
          }
          try {
            resolve(JSON.parse(stdout.trim()))
          } catch (parseError) {
            reject(new Error(`Питон вернул не JSON при пуше. Данные: ${stdout}`))
          }
        })

        // Безопасно упаковываем данные в один JSON и пихаем в поток ввода питона
        const payload = JSON.stringify({ tx_data, signature })
        child.stdin?.write(payload)
        child.stdin?.end()
      })
    }

    const result = await runPython()
    return NextResponse.json(result)

  } catch (error: any) {
    console.error("[API CHIA TX SUBMIT ERROR]:", error)
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 })
  }
}
