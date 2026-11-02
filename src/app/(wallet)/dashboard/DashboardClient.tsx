'use client'

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

import { ActionButtons } from "./_components/ActionButtons"
import { BalanceSection } from "./_components/BalanceSection"
import { AddressCard } from "./_components/AddressCard"
import { ActivityList } from "./_components/ActivityList"
import { ReceiveModal } from "./_components/ReceiveModal"
import { SendModal } from "./_components/SendModal"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"
import { UnlockPinForm } from "./UnlockPinForm"
import { useIdleTimer } from "@/hooks/useIdleTimer"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { BackupCard } from "./_components/BackupCard"
import WalletGlobalLoading from "../loading"

export default function DashboardClient() {
  const router = useRouter()
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isSendOpen, setIsSendOpen] = useState(false)

  const { checkInitialState } = useWalletAuth()

  console.log("dashboardclient")

  // Атомарные селекторы из хранилищ
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const isVerifying = useWalletSession((state) => state.isVerifying)
  const sessionHydrated = useWalletSession((state) => state._hasHydrated)
  const secureHydrated = useSecureStorage((state) => state._hasHydrated)

  const isHydrated = sessionHydrated && secureHydrated

  // Тяжелые фоновые хуки
  useIdleTimer()
 

  // 🛡️ 1. ЕДИНЫЙ ЖЕЛЕЗНЫЙ ЭФФЕКТ: Проверяем состояние кошелька сразу после гидратации RAM
  useEffect(() => {
    if (!isHydrated || isVerifying) return

    if (checkInitialState() === "NO_WALLET") {
      router.push("/auth")
    }
  }, [isHydrated, isVerifying, checkInitialState, router])

  // 🛡️ 2. ИНТЕРВАЛ БЕЗОПАСНОСТИ: Регулярный чек валидности ключей в RAM
  useEffect(() => {
    if (isScreenLocked || !isHydrated || isVerifying) return
    
    const interval = setInterval(() => { 
      if (checkInitialState() === "NO_WALLET") {
        router.replace("/auth")
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [isScreenLocked, isHydrated, isVerifying, checkInitialState, router])

  // 🛡️ 3. ЧИСТОЕ ВЫЧИСЛЕНИЕ ЗАГРУЗКИ: Без локальных стейтов и лишних тиков
  const isLoading = !isHydrated || isVerifying

  if (isLoading) {
    return <WalletGlobalLoading />
  }

  // Экран блокировки сессии
  if (isScreenLocked) {
    return (
      <div className="w-full py-12 animate-in fade-in duration-200">
        <UnlockPinForm />
      </div>
    )
  }

  // Основной контент дашборда кошелька
  return (
    <>
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        <BalanceSection />
        <AddressCard />
        <ActionButtons 
          onReceiveClick={() => setIsReceiveOpen(true)} 
          onSendClick={() => setIsSendOpen(true)} 
        />
        <ActivityList />
        <BackupCard />
      </div>

      <ReceiveModal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} />
      <SendModal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} />
    </>
  )
}
