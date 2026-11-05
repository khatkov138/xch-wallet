'use client'

import React from "react"
import { useRouter } from "next/navigation" // 🚀 Нативный роутер Next.js
import { WalletHeader } from "./WalletHeader"
import { useWalletAuth } from "@/hooks/useWalletAuth"

import { useSecureStore } from "@/store/useSecureStore"
import { useWalletSessionStore } from "@/store/useWalletSessessionStore" 

export function WalletHeaderContainer() {
  const router = useRouter()
  const { hardResetWallet } = useWalletAuth() // Функция очистки ключей и сброса куки isAuth в false

  const activePkHex = useWalletSessionStore((state) => state.unhardenedPkHex)
  const isScreenLocked = useWalletSessionStore((state) => state.isScreenLocked)
  
  // Проверяем гидратацию сессионных хранилищ вкладки для показа кнопки
  const isSessionHydrated = useWalletSessionStore((state) => state._hasHydrated)
  const isSecureHydrated = useSecureStore((state) => state._hasHydrated)
  const isStoreHydrated = isSessionHydrated && isSecureHydrated

  const showLogout = isStoreHydrated && !!activePkHex && !isScreenLocked

  const handleLogout = () => {
    // 1. Полностью стираем сессию, диск и куку (с мгновенным noWalletMode под капотом)
    hardResetWallet() 
    
    // 2. Спокойно обновляем серверные компоненты, чтобы зафиксировать чистый URL
    router.refresh()
  }


  return (
    <div className="w-full">
      <WalletHeader 
        showLogout={showLogout}
        onLogout={handleLogout}
      />
    </div>
  )
}
