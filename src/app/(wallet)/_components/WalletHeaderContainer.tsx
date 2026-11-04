'use client'

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { useWalletStatus } from "@/hooks/useWalletStatus"
import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"

import { WalletBanner } from "./WalletBanner"
import { WalletHeader } from "./WalletHeader"
import { useWalletContext } from "../WalletContext"

export function WalletHeaderContainer() {
  const { triggerGlobalLogout } = useWalletContext()
  const { isPythonDown, isRpcDown, isNotSynced, hasError, isLoading, nodeData } = useWalletStatus()

  const [isClientReady, setIsClientReady] = useState(false)

  useEffect(() => {
    setIsClientReady(true)
  }, [])

  // 🛡️ Фикс Rules of Hooks: Достаем только реактивные примитивы
  const activePkHex = useWalletSession((state) => state.unhardenedPkHex)
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  
  const isSessionHydrated = useWalletSession((state) => state._hasHydrated)
  const isSecureHydrated = useSecureStorage((state) => state._hasHydrated)
  const isStoreHydrated = isSessionHydrated && isSecureHydrated

  const showLogout = isClientReady && isStoreHydrated && !!activePkHex && !isScreenLocked
  const isBannerHidden = nodeData?.isSynced === true && !hasError

  // Мемоизированный расчет статуса сети
  const headerStatus = useMemo(() => {
    if (isPythonDown || isRpcDown) {
      return { 
        text: "Offline", 
        dotClass: "bg-[#FF2E93]", 
        badgeClass: "text-[#FF2E93] bg-[#FF2E93]/10 border-[#FF2E93]/20 hover:bg-[#FF2E93]/15" 
      }
    }
    if (isLoading && !nodeData) {
      return { 
        text: "Loading...", 
        dotClass: "bg-zinc-500", 
        badgeClass: "text-zinc-400 bg-zinc-800/40 border-zinc-700/50" 
      }
    }
    if (isNotSynced) {
      return { 
        text: "Syncing", 
        dotClass: "bg-zinc-400", 
        badgeClass: "text-zinc-300 bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60" 
      }
    }
    return { 
      text: "Online", 
      dotClass: "bg-emerald-400", 
      badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15" 
    }
  }, [isPythonDown, isRpcDown, isLoading, nodeData, isNotSynced])

  // 🛡️ Абсолютно изолированный useCallback без мутаций реактивных хуков внутри
  const handleLogout = useCallback(() => {
    triggerGlobalLogout(() => {
      // Используем императивный нереактивный метод вызова экшена Zustand стора
      useWalletSession.getState().setScreenLocked(false)
    })
  }, [triggerGlobalLogout])

  return (
    <div className="w-full space-y-4">
      {isClientReady && (
        <WalletBanner 
          isPythonDown={isPythonDown}
          isRpcDown={isRpcDown}
          isNotSynced={isNotSynced}
          isBannerHidden={isBannerHidden}
          progressPercent={nodeData?.progressPercent || "0.0000"}
          currentHeight={nodeData?.currentHeight || 0}
          targetHeight={nodeData?.targetHeight || 0}
        />
      )}

      <WalletHeader 
        isClientReady={isClientReady}
        currentNetwork={nodeData?.network || null}
        statusText={headerStatus.text}
        statusBadgeClass={headerStatus.badgeClass}
        statusDotClass={headerStatus.dotClass}
        showLogout={showLogout}
        onLogout={handleLogout}
      />
    </div>
  )
}
