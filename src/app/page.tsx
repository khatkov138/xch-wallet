'use client'

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useWalletAuth } from "@/hooks/useWalletAuth" // Используем твой хук

export default function HomePage() {
  const router = useRouter()
  
  // Достаем метод проверки роутов строго из твоего хука диспетчера
  const { checkInitialState } = useWalletAuth()

  useEffect(() => {
    // Вызываем бизнес-логику из хука
    const state = checkInitialState()

    if (state === "NO_WALLET") {
      router.replace("/auth")
    } else {
      // Если кошелек на диске найден (хоть заблокированный, хоть нет) — пускаем на дашборд
      router.replace("/dashboard")
    }
  }, [checkInitialState, router])

  return (
    <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Твой премиальный финтех-фон во время мгновенного редиректа */}
      <div className="absolute w-[250px] h-[250px] bg-[#FF2E93]/10 blur-[80px] rounded-full animate-pulse pointer-events-none" />
      
      <div className="flex flex-col items-center gap-4 relative z-10">
        <div className="bg-white text-black font-black text-xl px-5 py-2.5 rounded-2xl tracking-tight shadow-2xl select-none">
          XCH<span className="text-[#FF2E93]">A</span>
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF2E93] border-2 border-zinc-950" />
        </div>
        <Loader2 size={16} className="animate-spin text-zinc-500" />
      </div>
    </div>
  )
}
