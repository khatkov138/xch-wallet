import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Стучимся на 8000 порт к твоему Python бэкенду
    const response = await fetch('http://127.0.0.1:8000/api/ping', { 
      signal: AbortSignal.timeout(2000), // Таймаут 2 секунды
      cache: 'no-store' // Отключаем кэш, чтобы проверять в реальном времени
    });

    if (response.ok) {
      return NextResponse.json({ status: 'healthy', message: 'ok' });
    }
  } catch (error) {
    // Сюда попадаем при ошибке сети или таймауте
  }

  return NextResponse.json(
    { status: 'unhealthy', message: 'Python бэкенд НЕ ДОСТУПЕН!' }, 
    { status: 503 }
  );
}
