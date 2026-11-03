'use client'

import React from "react"
import { AuthBackground } from "../(wallet)/_components/AuthBackground"

interface ExplorerLayoutProps {
  children: React.ReactNode
}

export default function ExplorerLayout({ children }: ExplorerLayoutProps) {
  return (
    <div className="relative min-h-screen w-full bg-zinc-950 flex flex-col justify-between z-0">
      {/* Железный фон кошелька */}
      <div className="fixed inset-0 w-screen h-screen z-[-1] overflow-hidden pointer-events-none">
        <AuthBackground />
      </div>

      {/* Ограничиваем контейнер чуть шире кошелька (max-w-xl), так как в эксплорере много данных */}
      <div className="w-full max-w-xl mx-auto px-4 py-8 flex-1 flex flex-col relative z-10">
        <main className="w-full animate-in fade-in duration-300">
          {children}
        </main>
      </div>
    </div>
  )
}
