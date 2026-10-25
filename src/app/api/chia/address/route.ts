import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"
import fs from "fs"
import os from "os"

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

    // 2. Путь к вашему питоновскому скрипту
    let scriptPath = path.resolve(process.cwd(), "src/python/get_address.py")
    
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.resolve(process.cwd(), "python/get_address.py")
    }

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { status: "error", message: `Скрипт не найден по пути: ${scriptPath}` },
        { status: 500 }
      )
    }

    // 3. Формируем точный путь к исполняемому файлу Python в LocalAppData
    const homeDir = process.env.USERPROFILE || os.homedir() || "C:\\Users\\khatk"
    const windowsPythonPath = path.join(
      homeDir, 
      "AppData", 
      "Local", 
      "Programs", 
      "Python", 
      "Python312", 
      "python.exe"
    )

    // Выбираем путь: на Windows берем твой точный python.exe, на Linux/Mac оставляем python3
    const pythonExecutable = process.platform === "win32" ? windowsPythonPath : "python3"
    const args = [scriptPath, wallet_pk_hex]

    // 4. Запуск процесса
    const runPython = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        execFile(pythonExecutable, args, { windowsHide: true }, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Ошибка выполнения скрипта: ${error.message}. Stderr: ${stderr}`))
            return
          }
          
          const output = stdout.trim()
          if (!output) {
            reject(new Error(`Скрипт отработал, но ничего не вывел в stdout. Stderr: ${stderr}`))
            return
          }
          
          try {
            const parsedData = JSON.parse(output)
            resolve(parsedData)
          } catch (parseError) {
            reject(new Error(`Питон вернул не JSON. Данные: ${output}`))
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
