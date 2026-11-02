'use client'

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletStatus } from "@/hooks/useWalletStatus"

// 🛡️ 1. ИЗОЛИРОВАННАЯ КАСУЛА ДЛЯ СЕТЕВОГО ХУКА
// Этот микроблок заберет весь спам ререндеров на себя и не пустит его выше в шапку и лейаут
function NetworkStatusIndicator() {
  const { isPythonDown, isRpcDown, isNotSynced, isLoading, nodeData } = useWalletStatus()

  // Лог покажет, что тикает ТОЛЬКО этот индикатор, а лейаут замер
  console.log('📡 [TICK STATUS]:', nodeData?.currentHeight)

  let statusText = "Online"
  let statusBadgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15"
  let statusDotClass = "bg-emerald-400"

  if (isPythonDown || isRpcDown) {
    statusText = "Offline"
    statusBadgeClass = "text-[#FF2E93] bg-[#FF2E93]/10 border-[#FF2E93]/20 hover:bg-[#FF2E93]/15"
    statusDotClass = "bg-[#FF2E93]"
  } else if (isLoading && !nodeData) {
    statusText = "Loading..."
    statusBadgeClass = "text-zinc-400 bg-zinc-800/40 border-zinc-700/50"
    statusDotClass = "bg-zinc-500"
  } else if (isNotSynced) {
    statusText = "Syncing"
    statusBadgeClass = "text-zinc-300 bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60"
    statusDotClass = "bg-zinc-400"
  }

  return (
    <Link
      href="/status"
      className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 ${statusBadgeClass}`}
      title="Open network status node monitor"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${statusText !== "Loading..." ? "animate-pulse" : ""} ${statusDotClass}`} />
      {statusText}
    </Link>
  )
}

// 🛡️ 2. СТАТИЧНЫЙ КАРКАС ШАПКИ
// В нем больше нет сетевых хуков, он ссылочно стабилен для WalletLayout
export function WalletHeader() {
  const pathname = usePathname()
  const { hardResetWallet } = useWalletAuth()

  const isDash = pathname?.includes("/dashboard")
  const version = "v0.2.0"

  const handleResetWallet = () => {
    hardResetWallet()
    window.location.href = "/auth"
  }

  return (
    <header className="flex items-center justify-between w-full pt-2 select-none">
      
      {/* ЛЕВАЯ КОЛОНКА: Брендинг */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="relative flex items-center justify-center bg-zinc-900/40 border border-zinc-850 text-white font-black text-xs px-3.5 py-1.5 rounded-xl tracking-tight shadow-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/60 active:scale-[0.98] cursor-pointer"
        >
          XCH<span className="text-[#FF2E93]">A</span>
          <span className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#FF2E93] border border-zinc-950 ${isDash ? "animate-pulse" : ""}`} />
        </Link>

        {isDash ? (
          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border text-zinc-500 bg-zinc-900/20 border-zinc-900">
            MAINNET
          </span>
        ) : (
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">
            {version}
          </span>
        )}
      </div>

      {/* ПРАВАЯ КОЛОНКА: Изолированный статус сети и выход */}
      {isDash ? (
        <div className="flex items-center gap-2">
          
          {/* Вставляем изолированную капсулу статуса */}
          <NetworkStatusIndicator />

          <button
            onClick={handleResetWallet}
            className="p-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer active:scale-95"
          >
            <LogOut size={13} />
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900/40 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          Non-Custodial
        </div>
      )}

    </header>
  )
}
