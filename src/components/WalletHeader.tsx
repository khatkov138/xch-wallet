'use client'

import React from "react"
import { LogOut } from "lucide-react"
import { useWalletAuth } from "@/hooks/useWalletAuth"
// ⚡ ЗАМЕНИЛИ СТОР НА НАШ УМНЫЙ ХУК-ФАСАД

interface WalletHeaderProps {
  variant: "auth" | "dashboard"
  version?: string
}

export function WalletHeader({ variant, version = "v0.2.0" }: WalletHeaderProps) {
  // Достаем метод полной очистки сессии и блокировки из хука
  const { hardResetWallet } = useWalletAuth()

  const isDash = variant === "dashboard"
  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"

  const handleResetWallet = () => {
    // Хук под капотом сам очистит и localStorage, и sessionStorage
    hardResetWallet()
    // Перенаправляем на страницу авторизации/создания
    window.location.href = "/auth"

  }
  return (
    <header className="flex items-center justify-between w-full pt-2 select-none">

      {/* ЛЕВАЯ КОЛОНКА: Логотип и сеть */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center bg-white text-black font-black text-sm px-3.5 py-1.5 rounded-xl tracking-tight shadow-md">
          XCH<span className="text-[#FF2E93]">A</span>
          <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#FF2E93] border border-zinc-950 ${isDash ? "animate-pulse" : ""
            }`} />
        </div>

        {isDash ? (
          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border transition-all duration-300 ${isTestnet
            ? "text-[#FF2E93] bg-[#FF2E93]/5 border-[#FF2E93]/20 shadow-sm shadow-[#FF2E93]/5"
            : "text-zinc-400 bg-zinc-900/60 border-zinc-800"
            }`}>
            {isTestnet ? "TESTNET 11" : "MAINNET"}
          </span>
        ) : (
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
            {version}
          </span>
        )}
      </div>

      {/* ПРАВАЯ КОЛОНКА: Статус и выход */}
      {isDash ? (
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Онлайн
          </div>
          <button
            onClick={handleResetWallet}
            title="Выйти из кошелька"
            className="p-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer active:scale-95"
          >
            <LogOut size={13} />
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Non-Custodial
        </div>
      )}

    </header>
  )
}
