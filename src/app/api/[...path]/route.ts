import { NextRequest, NextResponse } from "next/server";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
const PROXY_SECRET_TOKEN = process.env.PROXY_SECRET_TOKEN || "chia_wallet_ultra_secure_token_2026";

// 🎯 В Next.js 16 объект params строго типизируется как Promise и требует обязательного await
export async function handleProxy(
  req: NextRequest, 
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // 🎯 Разворачиваем Promise параметров пути строго до начала работы с URL
    const { path } = await params;
    
    if (!path || !Array.isArray(path)) {
      throw new Error("Неверный формат параметров пути Catch-all роута");
    }

    const url = new URL(req.url);
    
    // Формируем чистый целевой URL на питоне
    const targetUrl = `${PYTHON_BACKEND_URL}/api/${path.join("/")}${url.search}`;
    
    const headers = new Headers(req.headers);
    headers.set("host", new URL(PYTHON_BACKEND_URL).host);
    headers.set("x-proxy-secret", PROXY_SECRET_TOKEN);

    let body: any = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.text();
    }

    const pythonResponse = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      cache: "no-store",
    });

    const responseData = await pythonResponse.text();

    return new NextResponse(responseData, {
      status: pythonResponse.status,
      statusText: pythonResponse.statusText,
      headers: pythonResponse.headers,
    });

  } catch (error: any) {
    console.error("❌ [NEXT 16 PROXY CRITICAL ERROR]", error);
    return NextResponse.json(
      { detail: `Ошибка проксирования на Python-бэкенд: ${error.message}` },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
