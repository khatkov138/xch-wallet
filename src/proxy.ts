import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { DEFAULT_LANGUAGE, isSupportedLanguage, WalletLanguage } from '@/config/i18n'
import { getServerSettings } from './lib/utils/server-utils'

export async function proxy(request: NextRequest) {
  // 🌟 Достаем не только pathname, но и search (оригинальную строку GET-параметров ?txId=...)
  const { pathname, search } = request.nextUrl

  // 1. СТРОГИЕ ИСКЛЮЧЕНИЯ ИЗ ИНФРАСТРУКТУРНОГО РОУТИНГА ЛОКАЛИЗАЦИИ
  if (
    pathname === '/wallet' || 
    pathname.startsWith('/wallet/') || 
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  // 2. Вытаскиваем настройки из единой куки Zustand через утилиту
  const settings = await getServerSettings()
  const cookieLang = settings?.language

  // 3. Вычисляем текущий язык (кука -> браузер -> дефолт)
  let targetLang: WalletLanguage = DEFAULT_LANGUAGE
  if (cookieLang && isSupportedLanguage(cookieLang)) {
    targetLang = cookieLang
  } else {
    const acceptLanguage = request.headers.get('accept-language') || ''
    if (acceptLanguage.includes('ru')) {
      targetLang = 'ru'
    }
  }

  // 4. Если в URL еще НЕТ языкового префикса (строка не начинается с /en или /ru)
  if (!pathname.startsWith('/en') && !pathname.startsWith('/ru')) {
    
    // Если зашли на чистый корень "/" -> кидаем на /[lang]
    if (pathname === '/') {
      // 🌟 ИСПРАВЛЕНО: Пробрасываем search хвост, если он был на корневом запросе
      return NextResponse.redirect(new URL(`/${targetLang}${search}`, request.url))
    }

    // 🎯 ДИНАМИЧЕСКИЙ DRY-ОБРАБОТЧИК ИСПРАВЛЕН:
    // Запрос на /explorer/coin/0x...?txId=0x... 
    // Теперь превратится в /ru/explorer/coin/0x...?txId=0x... БЕЗ ПОТЕРЬ ДАННЫХ!
    return NextResponse.redirect(new URL(`/${targetLang}${pathname}${search}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  /* 
    Матчим абсолютно всё приложение, ИСКЛЮЧАЯ:
    - Системные файлы Next.js (_next)
    - Внутренние API роуты (api)
    - Статику (картинки, фавиконки, шрифты)
  */
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
