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
import { SendModal } from "./_components/send-modal/SendModal"

export default function DashboardClient() {
  const router = useRouter()
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isSendOpen, setIsSendOpen] = useState(false)

  // Флаг того, что первичный охранный чек завершен
  const [authChecked, setAuthChecked] = useState(false)

  const { checkInitialState } = useWalletAuth()

  // Достаем стейты и методы изменения экранов
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const isVerifying = useWalletSession((state) => state.isVerifying)
  const setScreenLocked = useWalletSession((state) => state.setScreenLocked)
  const setVerifying = useWalletSession((state) => state.setVerifying)

  const sessionHydrated = useWalletSession((state) => state._hasHydrated)
  const secureHydrated = useSecureStorage((state) => state._hasHydrated)
  const isHydrated = sessionHydrated && secureHydrated

  // Тяжелые фоновые хуки простоя экрана
  useIdleTimer()

  // 🛡️ ЕДИНЫЙ УМНЫЙ ЭФФЕКТ: Проверяем статус и выставляем флаги ПОСЛЕ загрузки хранилищ
  useEffect(() => {
    if (!isHydrated) return

    const walletState = checkInitialState()

    if (walletState === "NO_WALLET") {
      setScreenLocked(false)
      setVerifying(false)
      router.replace("/wallet/auth")
    } else if (walletState === "NEED_UNLOCK") {
      setScreenLocked(true)
      setVerifying(false)
      setAuthChecked(true) // Чек завершен, мы знаем что нужно показать форму ввода пина
    } else if (walletState === "AUTHORIZED") {
      setScreenLocked(false)
      setVerifying(false)
      setAuthChecked(true) // Чек завершен, пускаем в дашборд
    }
  }, [isHydrated, checkInitialState, router, setScreenLocked, setVerifying])

  // Если базы Zustand еще грузятся с диска или мы не распределили первичный роутинг — стоим на системном loading.tsx
  if (!isHydrated || !authChecked) {
    return null
  }

  // Экран блокировки сессии (встает вместо контента, если сессия залочена)
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
