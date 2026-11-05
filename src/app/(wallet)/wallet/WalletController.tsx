'use client'

import React, { useEffect } from "react"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useIdleTimer } from "@/hooks/useIdleTimer"

// 🌐 ИМПОРТЫ: Только чистые, живые реактивные стейты
import { useWalletSessionStore } from "@/store/useWalletSessessionStore"
import { useSecureStore } from "@/store/useSecureStore"
import { UnlockPinForm } from "./_components/UnlockPinForm"
import DashboardClient from "./_components/DashboardClient"

export function WalletController() {
  const { initWalletState } = useWalletAuth()

  // Подписка на реактивные стейты для тупого роутинга
  const isScreenLocked = useWalletSessionStore((state) => state.isScreenLocked)
  const hasWallet = useSecureStore((state) => state.hasWallet)

  // Контроль простоя
  useIdleTimer()

  // Запускаем инициализацию строго 1 раз на клиенте
  useEffect(() => {
    initWalletState()
  }, [initWalletState])

  // 🚀 ИДЕАЛЬНЫЙ ТУПОЙ РОУТИНГ:
  if (hasWallet && isScreenLocked) {
    return <UnlockPinForm />
  }

  return <DashboardClient />
}
