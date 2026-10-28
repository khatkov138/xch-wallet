import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import https from "https";
import os from "os";

export async function POST(request: NextRequest) {
  try {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
    const body = await request.json().catch(() => ({}));

    // Проверяем, что фронтенд прислал собранный и подписанный пакет трат монет
    if (!body.spend_bundle) return NextResponse.json({ success: false, error: "Missing spend_bundle in request body" }, { status: 400 });

    // Настройка SSL-сертификатов для безопасного подключения к локальной ноде Chia RPC
    const home = process.env.USERPROFILE || os.homedir() || "C:\\Users\\khatk";
    let sP = path.join(home, ".chia", isTestnet ? "testnet11" : "mainnet", "config", "ssl", "full_node");
    if (!fs.existsSync(path.join(sP, "private_full_node.crt"))) sP = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;

    const agent = new https.Agent({ cert: fs.readFileSync(path.join(sP, "private_full_node.crt")), key: fs.readFileSync(path.join(sP, "private_full_node.key")), rejectUnauthorized: false });

    // Прокидываем SpendBundle в ноду через стандартный RPC-метод push_tx
    const result = await new Promise<any>((resolve) => {
      const d = JSON.stringify({ spend_bundle: body.spend_bundle });
      const req = https.request(`https://localhost:8555/push_tx`, { method: "POST", agent, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(d, "utf8") } }, (res) => {
        const c: Buffer[] = []; res.on("data", (b) => c.push(b)); res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(c).toString("utf8"))); } catch { resolve({ success: false }); } });
      }); req.write(d); req.end();
    });

    // Возвращаем фронтенду ответ мемпула ноды (содержит success: true/false и статус ноды)
    return NextResponse.json({ success: result.success, node_response: result });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 });
  }
}
