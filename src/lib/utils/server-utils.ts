import { NextResponse } from "next/server";
import { cookies } from 'next/headers'
import { UserSettingsProps } from '@/store/useUserSettingsStore'

// Для api 
export async function createApiResponse<T>(fn: () => Promise<T>) {
    try {
        const result = await fn();
        return NextResponse.json({ success: true, data: result, error: null });
    } catch (error) {
        console.error("API_ERROR:", error);
        return NextResponse.json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : "Internal Error",
        }, { status: 500 });
    }
}


// 🛡️ Безопасный серверный парсер единой куки Zustand
export async function getServerSettings(): Promise<Partial<UserSettingsProps>> {
  const cookieStore = await cookies()
  const rawJson = cookieStore.get('xchia-user-settings')?.value

  if (!rawJson) return {}

  try {
    const parsed = JSON.parse(decodeURIComponent(rawJson))
    return parsed?.state || {}
  } catch (e) {
    return {}
  }
}

