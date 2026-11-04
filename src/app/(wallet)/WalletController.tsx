'use client'

import React, { useEffect, useState } from "react"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"
import { useIdleTimer } from "@/hooks/useIdleTimer"
import { useWalletContext } from "./WalletContext"
import DashboardClient from "./wallet/DashboardClient"
import AuthClient from "./wallet/AuthClient"
import { UnlockPinForm } from "./wallet/UnlockPinForm"

export function WalletController() {
  const { network, isExiting } = useWalletContext()
  const [authChecked, setAuthChecked] = useState(false)
  const { checkInitialState } = useWalletAuth()

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
  }, [isHydrated, isExiting, network, checkInitialState, setScreenLocked, setVerifying, setNoWalletMode])

  if (!isHydrated || !authChecked) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border border-zinc-600 border-t-[#FF2E93]" />
      </div>
    )
  }

  if (isExiting) {
    return <DashboardClient />
  }

  if (noWalletMode) return <AuthClient />
  if (isScreenLocked) return <UnlockPinForm />
  
  return <DashboardClient />
}
