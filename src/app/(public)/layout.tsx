'use client'

import React from "react"
import { AuthBackground } from "../(wallet)/_components/AuthBackground"

interface ExplorerLayoutProps {
  children: React.ReactNode
}

export default function ExplorerLayout({ children }: ExplorerLayoutProps) {
  return (
    <div className="relative min-h-screen w-full bg-zinc-950 flex flex-col justify-between z-0">
      {/* Железный фон кошелька — рендерится один раз на всю директорию */}
      <div className="fixed inset-0 w-screen h-screen z-[-1] overflow-hidden pointer-events-none">
        <AuthBackground />
      </div>

      {/* РАСШИРИЛИ КОНТЕЙНЕР до max-w-6xl, чтобы колонки лендинга встали бок о бок */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col relative z-10">
        <main className="w-full flex-1 flex flex-col justify-center animate-in fade-in duration-300">
          {children}
        </main>
      </div>
    </div>
  )
}
