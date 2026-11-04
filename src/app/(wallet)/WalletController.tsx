'use client'

import React, { useEffect, useState } from "react"

import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"
import { useIdleTimer } from "@/hooks/useIdleTimer"
import { useWalletContext } from "./WalletContext"
import DashboardClient from "./[network]/wallet/DashboardClient"
import AuthClient from "./[network]/wallet/AuthClient"
import { UnlockPinForm } from "./[network]/wallet/UnlockPinForm"

export function WalletController() {
  const { network, isExiting } = useWalletContext()
  
  const [authChecked, setAuthChecked] = useState(false)

  const { checkInitialState } = useWalletAuth()

  // 🛡️ Перевели управление режимом авторизации на Zustand стор сессии
  const noWalletMode = useWalletSession((state) => state.noWalletMode)
  const setNoWalletMode = useWalletSession((state) => state.setNoWalletMode)

  const isSessionHydrated = useWalletSession((state) => state._hasHydrated)
  const isSecureHydrated = useSecureStorage((state) => state._hasHydrated)
  const isHydrated = isSessionHydrated && isSecureHydrated

  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const setScreenLocked = useWalletSession((state) => state.setScreenLocked)
  const setVerifying = useWalletSession((state) => state.setVerifying)

  useIdleTimer()

  useEffect(() => {
    if (!isHydrated || isExiting) return

    const walletState = checkInitialState()

    if (walletState === "NO_WALLET") {
      setScreenLocked(false)
      setVerifying(false)
      setNoWalletMode(true)
      setAuthChecked(true)
    } else if (walletState === "NEED_UNLOCK") {
      setScreenLocked(true)
      setVerifying(false)
      setNoWalletMode(false)
      setAuthChecked(true)
    } else if (walletState === "AUTHORIZED") {
      setScreenLocked(false)
      setVerifying(false)
      setNoWalletMode(false)
      setAuthChecked(true)
    }
  }, [isHydrated, isExiting, network, checkInitialState])

  if (!isHydrated || !authChecked) {
    return null
  }

  if (isExiting) {
    return <DashboardClient />
  }

  if (noWalletMode) return <AuthClient />
  if (isScreenLocked) return <UnlockPinForm />
  
  return <DashboardClient />
}
