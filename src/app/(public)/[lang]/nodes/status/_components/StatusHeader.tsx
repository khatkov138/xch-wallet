'use client'

import React from "react"

interface StatusHeaderProps {
  network: string
  isRpcDown: boolean
  isConnecting: boolean
  isSynced: boolean
}

export function StatusHeader({ network, isRpcDown, isConnecting, isSynced }: StatusHeaderProps) {
  let statusText = "Working"
  let statusColor = "text-emerald-400"
  let ledColor = "bg-emerald-400 shadow-[0_0_6px_#34d399]"

  if (isRpcDown) {
    statusText = "Offline"
    statusColor = "text-[#FF2E93]"
    ledColor = "bg-[#FF2E93] shadow-[0_0_6px_#FF2E93]"
  } else if (isConnecting) {
    statusText = "Connecting"
    statusColor = "text-amber-400"
    ledColor = "bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse"
  } else if (!isSynced) {
    // 🚀 ИЗМЕНЕНО: Синхронизация теперь строгая серая, без лишней паники и желтизны
    statusText = "Syncing"
    statusColor = "text-zinc-400 font-bold"
    ledColor = "bg-zinc-500 shadow-[0_0_5px_#71717a] animate-pulse"
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-900/40 pb-3 relative z-10 select-none">
      <div className="text-base font-black text-white font-sans tracking-tight">
        {network === "MAINNET" ? "Mainnet Node" : "Testnet11 Node"}
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full">
        <span className={`h-1 w-1 rounded-full transition-all duration-300 ${ledColor}`} />
        <span className={`transition-colors duration-300 ${statusColor}`}>{statusText}</span>
      </div>
    </header>
  )
}
