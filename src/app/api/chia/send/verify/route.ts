import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
    try {
        const {
            wallet_pk_hex,
            message_hash_hex,
            signature_hex
        } = await req.json()

        if (!wallet_pk_hex || !message_hash_hex || !signature_hex) {
            return NextResponse.json(
                { status: "error", message: "Не все обязательные параметры переданы" },
                { status: 400 }
            )
        }

        const scriptPath = path.resolve(process.cwd(), "src/crypto/verify_tx_sig.py")

        const runPython = (): Promise<any> => {
            return new Promise((resolve, reject) => {
                const pythonExecutable = process.platform === "win32" ? "py" : "python3"

                // Передаем аргументы через командную строку, как в роуте create
                const args = process.platform === "win32"
                    ? ["-3.11", scriptPath, wallet_pk_hex, message_hash_hex, signature_hex]
                    : [scriptPath, wallet_pk_hex, message_hash_hex, signature_hex]

                execFile(pythonExecutable, args, (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Ошибка верификации подписи: ${error.message}. Stderr: ${stderr}`))
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
        console.error("[API CHIA TX VERIFY ERROR]:", error)
        return NextResponse.json({ status: "error", message: error.message }, { status: 500 })
    }
}
