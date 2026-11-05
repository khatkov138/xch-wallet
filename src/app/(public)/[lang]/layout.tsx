import { notFound } from 'next/navigation'
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from '@/config/i18n'

// ⚡ ОТКЛЮЧАЕМ INSTANT-ВАЛИДАЦИЮ ДЛЯ ЭТОГО СЕГМЕНТА В NEXT.JS 16
// Это говорит сборщику, что лейаут имеет право асинхронно читать URL данные параметров при переходе
export const instant = false

export function generateStaticParams() {
  return SUPPORTED_LANGUAGES.map((lang) => ({ lang }))
}

interface LangLayoutProps {
  children: React.ReactNode
  params: Promise<{ lang: string }> 
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  // Дожидаемся разрешения параметров, как требует спецификация Next.js 16
  const { lang } = await params

  // Если префикс в URL левый (например, /fr/explorer) — отдаем 404
  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  return <>{children}</>
}
