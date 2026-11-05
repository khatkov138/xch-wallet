import React from "react"
import Link from "next/link"
import { WalletLanguage } from "@/config/i18n"

interface HeaderProps {
  currentLang?: WalletLanguage
}

export function Header({ currentLang }: HeaderProps) {
  // Формируем базовые пути в зависимости от того, находимся ли мы внутри [lang] сегмента
  const homeHref = currentLang ? `/${currentLang}` : "/"
  const walletHref = "/wallet" // Наша изолированная страница всегда доступна по этому урлу
  const explorerHref = currentLang ? `/${currentLang}/explorer` : "/explorer"

  return (
    <header className="w-full h-14 flex items-center justify-between border-b border-zinc-900/40 backdrop-blur-sm bg-zinc-950/10 rounded-xl px-2 relative z-50 select-none">
      <div className="flex items-center gap-2">
        <Link 
          href={homeHref} 
          className="relative bg-zinc-900/40 border border-zinc-850 text-white font-black text-xs px-3 py-1 rounded-xl transition-all hover:border-zinc-700 active:scale-98"
        >
          XCH<span className="text-[#FF2E93]">IA</span>
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#FF2E93]" />
        </Link>
        <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded border text-zinc-500 bg-zinc-900/20 border-zinc-900 font-mono">
          TESTNET11
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Дополнительная ссылка на Эксплорер, если мы рендеримся, например, внутри кошелька */}
        <Link 
          href={explorerHref} 
          className="text-[10px] font-bold uppercase text-zinc-400 hover:text-white transition-all px-2 py-1.5"
        >
          Explorer
        </Link>
        
        <Link 
          href={walletHref} 
          className="text-[11px] font-bold uppercase bg-white text-zinc-950 px-3.5 py-1.5 rounded-xl hover:bg-zinc-200 active:scale-98 transition-all shadow-md shadow-white/5"
        >
          Вход
        </Link>
      </div>
    </header>
  )
}
