import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://127.0.0.1:8000';

// Хелпер для сквозного проброса запроса на Python-сервер
async function forwardToBackend(step: string, payload: any): Promise<any> {
  const response = await fetch(`${PYTHON_BACKEND_URL}/${step}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.error || `Python бэкенд вернул статус ${response.status}`);
  }

  return data;
}

// Next.js App Router асинхронный POST сегмент
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ step: string }> }
) {
  try {
    const { step } = await context.params;
    const payload = await request.json();

    console.log(`\n=== [ТРАНСПОРТ NEXT.JS] Проброс сегмента: /api/chia/debug/${step} ===`);

    // Валидация шагов на уровне роутера перед отправкой
    const validSteps = ['step1', 'step2', 'step3', 'step4'];
    if (!validSteps.includes(step)) {
      return NextResponse.json(
        { status: 'error', error: `Маршрут /debug/${step} не существует. Используйте step1, step2, step3 или step4.` },
        { status: 404 }
      );
    }

    // Отправка напрямую в память Python-сервера
    const result = await forwardToBackend(step, payload);

    console.log(`=== [ТРАНСПОРТ NEXT.JS] Сегмент /debug/${step} успешно выполнен ===`);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error(`❌ [ТРАНСПОРТ NEXT.JS] Ошибка на шаге:`, error.message);
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}
