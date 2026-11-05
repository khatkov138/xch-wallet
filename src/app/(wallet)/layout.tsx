import React from "react"
import { Background } from "@/components/Background"
import { WalletHeaderContainer } from "./_components/WalletHeaderContainer"
import { WalletFooter } from "./_components/WalletFooter"

// ⚡ ИСПРАВЛЕНИЕ ДЛЯ NEXT.JS 16: Разрешаем асинхронное чтение кук при переходе,
// полностью отключая ворнинги валидатора Instant Navigation для зоны кошелька.
export const instant = false

interface LayoutProps {
  children: React.ReactNode
}

export default async function WalletLayout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen w-full bg-zinc-950 flex flex-col justify-between z-0">
      
      {/* 🌌 ЕДИНЫЙ ЖЕЛЕЗНЫЙ ФОН НА ВСЕ ПРИЛОЖЕНИЕ КОШЕЛЬКА */}
      <div className="fixed inset-0 w-screen h-screen z-[-1] overflow-hidden pointer-events-none">
        <Background />
      </div>

      {/* Контентная область кошелька в строгих рамках max-w-md */}
      <div className="w-full max-w-md mx-auto px-6 py-10 flex-1 flex flex-col justify-between relative z-10">
        <div className="w-full space-y-6">
          
          {/* 🎯 ВЕРХНИЙ МОНОЛИТ: Шапка и баннеры */}
          <WalletHeaderContainer />

          {/* Динамический контент страниц кошелька */}
          <main className="w-full animate-in fade-in duration-300">
            {children}
          </main>
        </div>

        {/* 🎯 НИЖНИЙ МОНОЛИТ: Ультра-плотный футер кошелька */}
        <WalletFooter />
      </div>

    </div>
  )
}
