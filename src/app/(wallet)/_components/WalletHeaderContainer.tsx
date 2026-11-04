'use client'

import React, { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { LogOut } from "lucide-react"
import { useWalletStatus } from "@/hooks/useWalletStatus"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"

import { WalletBanner } from "./WalletBanner"
import { WalletHeader } from "./WalletHeader"

export function WalletHeaderContainer() {
  const { hardResetWallet } = useWalletAuth()
  const { isPythonDown, isRpcDown, isNotSynced, hasError, isLoading, nodeData } = useWalletStatus()

  // Флаг готовности клиента для безопасной гидратации
  const [isClientReady, setIsClientReady] = useState(false)
  useEffect(() => {
    setIsClientReady(true)
  }, [])

  // Состояния Zustand сторов
  const activePkHex = useWalletSession((state) => state.unhardenedPkHex)
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const sessionHydrated = useWalletSession((state) => state._hasHydrated)
  const secureHydrated = useSecureStorage((state) => state._hasHydrated)

  const isStoreHydrated = sessionHydrated && secureHydrated
  
  // Кнопку логаута вычисляем сразу (на сервере она скроется, на клиенте появится, если юзер авторизован)
  const showLogout = isClientReady && isStoreHydrated && !!activePkHex && !isScreenLocked

  const isSkeleton = isLoading && !nodeData
  const isBannerHidden = nodeData?.isSynced === true && !hasError

  // Конфигурация статуса для нижней шапки
    const headerStatus = useMemo(() => {
    // 1. ПЕРВЫЙ ПРИОРИТЕТ: Если упал питон или RPC — жестко Offline, игнорируя загрузку
    if (isPythonDown || isRpcDown) {
      return { 
        text: "Offline", 
        dotClass: "bg-[#FF2E93]", 
        badgeClass: "text-[#FF2E93] bg-[#FF2E93]/10 border-[#FF2E93]/20 hover:bg-[#FF2E93]/15" 
      }
    }
    // 2. ВТОРОЙ ПРИОРИТЕТ: Загрузка проверяется только если сеть физически доступна
    if (isLoading && !nodeData) {
      return { 
        text: "Loading...", 
        dotClass: "bg-zinc-500", 
        badgeClass: "text-zinc-400 bg-zinc-800/40 border-zinc-700/50" 
      }
    }
    // 3. ТРЕТИЙ ПРИОРИТЕТ: Нода в сети, проверяем синхронизацию
    if (isNotSynced) {
      return { 
        text: "Syncing", 
        dotClass: "bg-zinc-400", 
        badgeClass: "text-zinc-300 bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60" 
      }
    }
    // 4. ДЕФОЛТ: Полный синхрон
    return { 
      text: "Online", 
      dotClass: "bg-emerald-400", 
      badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15" 
    }
  }, [isPythonDown, isRpcDown, isLoading, nodeData, isNotSynced])

  const currentNetwork = nodeData?.network || null

  const handleLogout = useCallback(() => {
    hardResetWallet()
    window.location.href = "/"
  }, [hardResetWallet])

  return (
    <div className="w-full space-y-4">
      
      {/* ─── ВЕРХНИЙ БАННЕР ─── */}
      {/* Рендерится только на клиенте, чтобы не прыгала высота страницы на сервере */}
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

      {/* ─── ШАПКА ИНТЕРФЕЙСА (WALLET HEADER) ─── */}
      {/* Железный статичный каркас, который виден ВСЕГДА и не скрывается */}
      <WalletHeader 
        isClientReady={isClientReady}
        currentNetwork={currentNetwork}
        statusText={headerStatus.text}
        statusBadgeClass={headerStatus.badgeClass}
        statusDotClass={headerStatus.dotClass}
        showLogout={showLogout}
        onLogout={handleLogout}
      />

    </div>
  )
}
