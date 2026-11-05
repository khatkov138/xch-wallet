import React from "react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Background } from "@/components/Background"

interface PublicLayoutProps {
  children: React.ReactNode
  params: Promise<{ lang?: string }>
}

export default async function PublicLayout({ children, params }: PublicLayoutProps) {
  const resolvedParams = await params
  const currentLang = resolvedParams?.lang as any

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 flex flex-col justify-between z-0">
      
      {/* 🌌 Железный фон кошелька */}
      <div className="fixed inset-0 w-screen h-screen z-[-1] overflow-hidden pointer-events-none">
        <Background />
      </div>

      {/* Контейнер хедера и контента (остается аккуратным max-w-6xl) */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 flex-1 flex flex-col justify-between relative z-10">
        
        {/* Хедер сверху */}
        <div className="w-full pt-4 relative z-50">
          <Header currentLang={currentLang} />
        </div>

        {/* 🎯 Основной контент (Лендинг или Эксплорер) */}
        <main className="w-full flex-1 flex flex-col justify-center py-6 animate-in fade-in duration-300">
          {children}
        </main>
        
      </div>

      {/* 🚀 ПОЛНОЭКРАННЫЙ ФУТЕР (Вынесен из контейнера контента на всю ширину w-full) */}
      <div className="w-full border-t border-zinc-900/45 bg-transparent relative z-10 mt-auto">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-6">
          <Footer currentLang={currentLang} />
        </div>
      </div>
      
    </div>
  )
}
