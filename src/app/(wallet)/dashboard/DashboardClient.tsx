'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { ActionButtons } from "./_components/ActionButtons"
import { BalanceSection } from "./_components/BalanceSection"
import { AddressCard } from "./_components/AddressCard"
import { ActivityList } from "./_components/ActivityList"
import { ReceiveModal } from "./_components/ReceiveModal"

import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"
import { UnlockPinForm } from "./UnlockPinForm"
import { useIdleTimer } from "@/hooks/useIdleTimer"
import { BackupCard } from "./_components/BackupCard"
import WalletGlobalLoading from "../loading"
import { SendModal } from "./_components/send-modal/SendModal"

export default function DashboardClient() {
  const router = useRouter()
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isSendOpen, setIsSendOpen] = useState(false)

  // Локальный охранный стейт, чтобы предотвратить вспышки и дергания контента (CLS = 0)
  const [authChecked, setAuthChecked] = useState(false)

  const { checkInitialState } = useWalletAuth()

  console.log("dashboardclient")

  // Атомарные селекторы из хранилищ
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const isVerifying = useWalletSession((state) => state.isVerifying)
  const sessionHydrated = useWalletSession((state) => state._hasHydrated)
  const secureHydrated = useSecureStorage((state) => state._hasHydrated)

  const isHydrated = sessionHydrated && secureHydrated

  // Тяжелые фоновые хуки простоя экрана
  useIdleTimer()

  // 🛡️ ЕДИНЫЙ БЕЗОПАСНЫЙ ЭФФЕКТ: Проверяем ключи в RAM строго ПОСЛЕ монтирования, а не в рендере
  useEffect(() => {
    if (!isHydrated || isVerifying) return

    const walletState = checkInitialState()
    if (walletState === "NO_WALLET") {
      router.replace("/auth")
    } else {
      setAuthChecked(true)
    }
  }, [isHydrated, isVerifying, checkInitialState, router])

  // Регулярный интервал проверки валидности сессии
  useEffect(() => {
    if (isScreenLocked || !isHydrated || isVerifying || !authChecked) return

    const interval = setInterval(() => {
      if (checkInitialState() === "NO_WALLET") {
        router.replace("/auth")
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [isScreenLocked, isHydrated, isVerifying, authChecked, checkInitialState, router])

  // 🛡️ Жесткий расчет загрузки: Пока идет проверка или гидратация — контент ЗАБЛОКИРОВАН
  const isLoading = !isHydrated || isVerifying || !authChecked

  if (isLoading) {
    return <WalletGlobalLoading />
  }

  // Экран блокировки сессии (встает вместо контента)
  if (isScreenLocked) {
    return (
      <div className="w-full py-12 animate-in fade-in duration-200">
        <UnlockPinForm />
      </div>
    )
  }

  // Основной контент дашборда кошелька (твоя оригинальная верстка без изменений)
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
