import { redirect } from 'next/navigation'
import { WalletLanguage, isSupportedLanguage, DEFAULT_LANGUAGE } from '@/config/i18n'

interface ExplorerPageProps {
  params: Promise<{ lang: string }>
}

export const instant = false

export default async function ExplorerPage({ params }: ExplorerPageProps) {
  const { lang: rawLang } = await params

  // Валидируем язык из URL
  const currentLang: WalletLanguage = isSupportedLanguage(rawLang) 
    ? rawLang 
    : DEFAULT_LANGUAGE

  // Жесткий дефолт: всегда отправляем на mainnet
  redirect(`/${currentLang}/explorer/mainnet`)
}
