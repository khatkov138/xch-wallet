'use client'

import React, { useState } from "react"
import { useWalletAuth } from "@/hooks/useWalletAuth"

import { DashboardHeader } from "./_components/DashboardHeader"
import { ActionButtons } from "./_components/ActionButtons"
import { BalanceSection } from "./_components/BalanceSection"
import { AddressCard } from "./_components/AddressCard"
import { ActivityList } from "./_components/ActivityList"
import { BackupCard } from "./_components/BackupCard"
import { UnlockPinForm } from "./_components/UnlockPinForm"
import { ReceiveModal } from "./_components/ReceiveModal"

export default function DashboardPage() {
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)

  // Чистый вызов хука авторизации сессии кошелька
  const {
    walletAddress,
    decryptedPhrase,
    isVerifying,
    isScreenLocked,
    handleUnlockSuccess
  } = useWalletAuth()

  // 1. Экран первичной проверки при загрузке / F5
  if (isVerifying) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute w-[250px] h-[250px] bg-[#FF2E93]/10 blur-[80px] rounded-full animate-pulse pointer-events-none" />
        <div className="relative z-10 bg-white text-black font-black text-xl px-5 py-2.5 rounded-2xl tracking-tight shadow-2xl select-none">
          XCH<span className="text-[#FF2E93]">A</span>
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF2E93] border-2 border-zinc-950" />
        </div>
      </div>
    )
  }

  // 2. Экран блокировки сейфа поверх градиента
  if (isScreenLocked) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-25%] left-[-20%] w-[140%] h-[70vh] bg-gradient-to-br from-[#FF2E93]/20 via-[#8B5CF6]/10 to-transparent blur-[130px] pointer-events-none z-0" />
        <UnlockPinForm onUnlock={handleUnlockSuccess} />
      </div>
    )
  }

  // 3. Основной рабочий экран Дашборда (Вся верстка и неоны сохранены 1 в 1)
  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white font-sans antialiased overflow-hidden flex flex-col justify-between">
      <div className="absolute top-[-10%] right-[-20%] w-[130%] h-[50vh] bg-gradient-to-bl from-[#B82EFF]/15 via-[#FF2E93]/5 to-transparent blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[80vw] h-[50vh] bg-[#FF2E93]/5 blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 flex-1 flex flex-col justify-between py-8">
        <div className="w-full space-y-6">
          <DashboardHeader />

          {/* Баланс теперь сам знает, как себя запрашивать */}
          <BalanceSection currentAddress={walletAddress} />

          <AddressCard address={walletAddress} />

          <ActionButtons onReceiveClick={() => setIsReceiveOpen(true)} />

          <ActivityList currentAddress={walletAddress} />

          <BackupCard mnemonic={decryptedPhrase} />
        </div>

        <footer className="w-full text-center pt-8">
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">XCH Ecosystem • Secure Wallet Solution</p>
        </footer>
      </div>

      <ReceiveModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        walletAddress={walletAddress}
      />
    </div>
  )
}
