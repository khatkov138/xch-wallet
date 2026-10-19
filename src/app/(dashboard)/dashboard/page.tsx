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


        <footer className="w-full text-center pt-12 flex flex-col items-center gap-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors duration-200 group text-[10px] font-medium tracking-wide uppercase"
            title="Проверить исходный код на GitHub"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 fill-current transition-transform duration-200 group-hover:scale-110"
              aria-hidden="true"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span>Non-Custodial • Open Source Code</span>
          </a>
          <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">
            XCH Ecosystem • Secure Wallet Solution
          </p>
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
