'use client'

import React from "react"
import { AuthBackground } from "./auth/_components/AuthBackground"
import { WalletHeaderContainer } from "./_components/WalletHeaderContainer"
import { WalletFooter } from "./_components/WalletFooter"

const MemoizedAuthBackground = React.memo(AuthBackground)

interface WalletLayoutProps {
  children: React.ReactNode
}

export default function WalletLayout({ children }: WalletLayoutProps) {
  
  console.log('🧱 [RENDER] Глобальный WalletLayout с единым фоном')

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 flex flex-col justify-between z-0">
      
      {/* 🎯 ЕДИНЫЙ ЖЕЛЕЗНЫЙ ФОН НА ВСЕ ПРИЛОЖЕНИЕ */}
      <div className="fixed inset-0 w-screen h-screen z-[-1] overflow-hidden pointer-events-none">
        <MemoizedAuthBackground />
      </div>

      {/* Контентная область кошелька в строгих рамках max-w-md */}
      <div className="w-full max-w-md mx-auto px-6 py-10 flex-1 flex flex-col justify-between relative z-10">
        <div className="w-full space-y-6">
          
          {/* 🎯 ВЕРХНИЙ МОНОЛИТ: Баннер (WalletBanner) + Шапка (WalletHeader) */}
          <WalletHeaderContainer />
          
          {/* Динамический контент страниц кошелька */}
          <main className="w-full animate-in fade-in duration-300">
            {children}
          </main>
        </div>

        {/* 🎯 НИЖНИЙ МОНОЛИТ: Футер со ссылками и твоим сетевым баджем внутри */}
        <WalletFooter />
        
      </div>
    </div>
  )
}
