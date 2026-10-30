'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { ActionButtons } from "./_components/ActionButtons"
import { BalanceSection } from "./_components/BalanceSection"
import { AddressCard } from "./_components/AddressCard"
import { ActivityList } from "./_components/ActivityList"
import { BackupCard } from "./_components/BackupCard"

import { ReceiveModal } from "./_components/ReceiveModal"
import { SendModal } from "./_components/SendModal"
import { WalletLayout } from "@/components/WalletLayout"

import { useWalletAuth } from "@/hooks/useWalletAuth"

import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"
import { UnlockPinForm } from "./UnlockPinForm"
import { useIdleTimer } from "@/hooks/useIdleTimer"

export default function DashboardClient() {
  const router = useRouter()
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isSendOpen, setIsSendOpen] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  // 1. ДИСПЕТЧЕР (Только функции, стабильные ссылки, 0 ререндеров)
  const { checkInitialState } = useWalletAuth()

  // 2. ДАТЧИКИ (Точечные селекторы для реактивного UI)
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const isVerifying = useWalletSession((state) => state.isVerifying)
  const sessionHydrated = useWalletSession((state) => state._hasHydrated)
  const secureHydrated = useSecureStorage((state) => state._hasHydrated)

  // 3. АВТОМАТИЧЕСКИЙ ТРЕКЕР АКТИВНОСТИ (Уже внутри с троттлингом под капотом)
  useIdleTimer()

  // Первичный чек защищенных роутов после полной гидратации сторов
  useEffect(() => {
    if (!sessionHydrated || !secureHydrated) return

    const state = checkInitialState()
    if (state === "NO_WALLET") {
      router.push("/auth")
    } else {
      setHasChecked(true)
    }
  }, [sessionHydrated, secureHydrated, checkInitialState, router])

  // Периодический чек протухания сессии (раз в 5 сек вполне достаточно, без лавины вызовов)
  useEffect(() => {
    if (isScreenLocked || !hasChecked) return

    const interval = setInterval(() => {
      checkInitialState()
    }, 5000)

    return () => clearInterval(interval)
  }, [isScreenLocked, hasChecked, checkInitialState])

  // Ждем пока Zustand подгрузит localStorage во избежание Hydration Mismatch
  const isLoading = isVerifying || !hasChecked || !sessionHydrated || !secureHydrated

  if (isLoading) {
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

  if (isScreenLocked) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-25%] left-[-20%] w-[140%] h-[70vh] bg-gradient-to-br from-[#FF2E93]/20 via-[#8B5CF6]/10 to-transparent blur-[130px] pointer-events-none z-0" />
        <UnlockPinForm />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white font-sans antialiased overflow-hidden flex flex-col justify-between">
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

      <ReceiveModal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} />
      <SendModal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} />
    </div>
  )
}
