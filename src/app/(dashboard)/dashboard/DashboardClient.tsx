'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { ActionButtons } from "./_components/ActionButtons"
import { BalanceSection } from "./_components/BalanceSection"
import { AddressCard } from "./_components/AddressCard"
import { ActivityList } from "./_components/ActivityList"
import { BackupCard } from "./_components/BackupCard"
import { UnlockDashboardForm } from "./UnlockDashboardForm"
import { ReceiveModal } from "./_components/ReceiveModal"
import { SendModal } from "./_components/SendModal"
import { WalletLayout } from "@/components/WalletLayout"

import { useWalletAuth } from "@/hooks/useWalletAuth"

export default function DashboardClient() {
  const router = useRouter()
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isSendOpen, setIsSendOpen] = useState(false)

  // 🔥 ХУК ВСЁ ДЕЛАЕТ САМ: Просто забираем готовые стейты и методы
  const { isScreenLocked, isVerifying, checkInitialState } = useWalletAuth()

  // Запускаем проверку роутов при монтировании
  useEffect(() => {
    const state = checkInitialState()
    if (state === "NO_WALLET") {
      router.push("/auth")
    }
  }, [checkInitialState, router])

  // 🧱 ЭКРАН 1: Первичная проверка (Пока Zustand парсит память после F5)
  if (isVerifying) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
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

  // 🧱 ЭКРАН 2: Сейф закрыт (Кошелек есть, но сессия пустая)
  if (isScreenLocked) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-25%] left-[-20%] w-[140%] h-[70vh] bg-gradient-to-br from-[#FF2E93]/20 via-[#8B5CF6]/10 to-transparent blur-[130px] pointer-events-none z-0" />
        <UnlockDashboardForm />
      </div>
    )
  }

  // 🧱 ЭКРАН 3: Основной рабочий интерфейс дашборда
  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white font-sans antialiased overflow-hidden flex flex-col justify-between">
      {/* Декоративные блюр-споты */}
      <div className="absolute top-[-10%] right-[-20%] w-[130%] h-[50vh] bg-gradient-to-bl from-[#B82EFF]/15 via-[#FF2E93]/5 to-transparent blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[80vw] h-[50vh] bg-[#FF2E93]/5 blur-[120px] pointer-events-none z-0" />

      <WalletLayout variant="dashboard">
        <div className="w-full space-y-6">
          <BalanceSection />
          <AddressCard />
          <ActionButtons
            onReceiveClick={() => setIsReceiveOpen(true)}
            onSendClick={() => setIsSendOpen(true)}
          />
          <ActivityList />
          <BackupCard />
        </div>
      </WalletLayout>

      {/* Модалки */}
      <ReceiveModal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} />
      <SendModal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} />
    </div>
  )
}
