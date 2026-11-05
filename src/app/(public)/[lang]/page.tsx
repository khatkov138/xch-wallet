import React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { isSupportedLanguage, WalletLanguage } from "@/config/i18n"
import { LandingWidget } from "@/components/landing/LandingWidget"

interface PageProps {
  params: Promise<{ lang: string }>
}

export const instant = false

export default async function Page({ params }: PageProps) {
  const { lang } = await params

  // 🛡️ Жесткая валидация языка из URL на сервере
  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  const currentLang = lang as WalletLanguage

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-10 lg:py-16 flex-1 selection:bg-[#FF2E93]/30">
      
      {/* ЛЕВАЯ КОЛОНКА: МАРКЕТИНГ */}
      <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-400">
          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" /> 100% OPEN SOURCE & БЕЗ СКАЧИВАНИЙ
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05]">
          Безопасный кошелек <br />для Chia (XCH) <br />
          <span className="bg-gradient-to-r from-[#FF2E93] to-[#8B5CF6] bg-clip-text text-transparent">в твоем браузере</span>
        </h1>
        
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
          Ваша случайная фраза из 24 слов и ключи <strong className="text-zinc-200 font-bold">никогда не отправляются на наш сервер</strong>. 
          Наш проект имеет <strong className="text-[#FF2E93] font-bold">полностью открытый исходный код на GitHub</strong> — всё проверяемо и прозрачно. 
          Мы лишь выступаем в роли посыльного между вами и блокчейном Chia.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2 items-center">
          <Link href="/wallet" className="w-full sm:w-auto text-[11px] font-black uppercase bg-white text-zinc-950 px-6 py-3.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-lg shadow-white/5">
            <span>Открыть веб-кошелек</span> <ChevronRight size={12} />
          </Link>
          <Link href={`/${currentLang}/explorer`} className="w-full sm:w-auto text-[11px] font-bold uppercase bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 px-5 py-3.5 rounded-xl transition-all">
            Открыть Explorer
          </Link>
        </div>
      </div>

      {/* ПРАВАЯ КОЛОНКА: ИНТЕРАКТИВНЫЙ КЛИЕНТСКИЙ МАКЕТ КОШЕЛЬКА */}
      <LandingWidget currentLang={currentLang} />
      
    </div>
  )
}
