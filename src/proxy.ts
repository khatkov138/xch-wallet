import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, isSupportedLanguage } from '@/config/i18n'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/') {
    // 🍪 Читаем куку, которую Zustand поставил нативно
    const cookieLang = request.cookies.get('xchia-lang')?.value

    if (cookieLang && isSupportedLanguage(cookieLang)) {
      // Идеальный UX: кидаем туда, куда пользователь переключил кошелек вручную
      return NextResponse.redirect(new URL(`/${cookieLang}`, request.url))
    }

    // Если куки нет — берем язык системы/браузера
    const acceptLanguage = request.headers.get('accept-language') || ''
    const detectedLang = SUPPORTED_LANGUAGES.find((lang) => 
      acceptLanguage.toLowerCase().includes(lang)
    ) || DEFAULT_LANGUAGE

    return NextResponse.redirect(new URL(`/${detectedLang}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
