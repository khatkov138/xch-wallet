'use client'

import React from "react"
import { WalletHeader } from "./WalletHeader"
import { useWalletContext } from "../WalletContext"
import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"

export function WalletHeaderContainer() {
  const { triggerGlobalLogout } = useWalletContext()

  const activePkHex = useWalletSession((state) => state.unhardenedPkHex)
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  
  const isSessionHydrated = useWalletSession((state) => state._hasHydrated)
  const isSecureHydrated = useSecureStorage((state) => state._hasHydrated)
  const isStoreHydrated = isSessionHydrated && isSecureHydrated

  // Кнопка логаута покажется только после полной гидратации сторов на клиенте
  const showLogout = isStoreHydrated && !!activePkHex && !isScreenLocked

  const handleLogout = () => {
    triggerGlobalLogout(() => {
      useWalletSession.getState().setScreenLocked(false)
    })
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
