'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { ActionButtons } from "./_components/ActionButtons"
import { BalanceSection } from "./_components/BalanceSection"
import { AddressCard } from "./_components/AddressCard"
import { ActivityList } from "./_components/ActivityList"
import { BackupCard } from "./_components/BackupCard"
import { ReceiveModal } from "./_components/ReceiveModal"
import { SendModal } from "./_components/SendModal"
import { WalletLayout } from "@/components/WalletLayout"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletSession, useSecureStorage } from "@/store/useWalletStore"
import { UnlockPinForm } from "./UnlockPinForm"
import { useIdleTimer } from "@/hooks/useIdleTimer"

export default function DashboardClient() {
  const router = useRouter()
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isSendOpen, setIsSendOpen] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  const { checkInitialState } = useWalletAuth()

  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const isVerifying = useWalletSession((state) => state.isVerifying)
  const unhardenedPkHex = useWalletSession((state) => state.unhardenedPkHex)
  const activeIndexes = useWalletSession((state) => state.activeIndexes)
  const setActiveIndexes = useWalletSession((state) => state.setActiveIndexes)

  const sessionHydrated = useWalletSession((state) => state._hasHydrated)
  const secureHydrated = useSecureStorage((state) => state._hasHydrated)

  useIdleTimer()

  useEffect(() => {
    if (!sessionHydrated || !secureHydrated) return
    if (checkInitialState() === "NO_WALLET") {
      router.push("/auth")
    } else {
      setHasChecked(true)
    }
  }, [sessionHydrated, secureHydrated, checkInitialState, router])

  useEffect(() => {
    if (isScreenLocked || !hasChecked) return
    const interval = setInterval(() => { checkInitialState() }, 5000)
    return () => clearInterval(interval)
  }, [isScreenLocked, hasChecked, checkInitialState])

  // 🔥 Запрос просто крутится в фоне и наполняет глобальный кэш
  const isReadyToFetch = !isVerifying && hasChecked && sessionHydrated && secureHydrated && !isScreenLocked && !!unhardenedPkHex

  useQuery({
    queryKey: ["wallet-dashboard", unhardenedPkHex, activeIndexes],
    queryFn: async () => {
      const params = new URLSearchParams({
        publicKeyHex: unhardenedPkHex,
        mode: activeIndexes ? "light" : "heavy",
        limit: "200",
        ...(activeIndexes && { active_indexes: activeIndexes })
      })
      const res = await fetch(`http://localhost:8000/api/wallet/dashboard?${params.toString()}`)
      if (!res.ok) throw new Error("Sync failed")
      const json = await res.json()
      if (json.meta?.active_indexes) setActiveIndexes(json.meta.active_indexes.join(","))
      return json
    },
    enabled: isReadyToFetch,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false
  })

  const isLoading = isVerifying || !hasChecked || !sessionHydrated || !secureHydrated

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute w-[250px] h-[250px] bg-[#FF2E93]/10 blur-[80px] rounded-full animate-pulse pointer-events-none" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="bg-white text-black font-black text-xl px-5 py-2.5 rounded-2xl tracking-tight shadow-2xl select-none">
            XCH<span className="text-[#FF2E93]">A</span>
          </div>
          <Loader2 size={16} className="animate-spin text-zinc-500" />
        </div>
      </div>
    )
  }

  if (isScreenLocked) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        <UnlockPinForm />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white font-sans antialiased overflow-hidden flex flex-col justify-between">
      <WalletLayout variant="dashboard">
        <div className="w-full space-y-6">
          <BalanceSection />
          <AddressCard />
          <ActionButtons onReceiveClick={() => setIsReceiveOpen(true)} onSendClick={() => setIsSendOpen(true)} />
            <ActivityList />
         {/* 
          <BackupCard />*/}
        </div>
      </WalletLayout>

      <ReceiveModal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} />
      <SendModal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} />
    </div>
  )
}
