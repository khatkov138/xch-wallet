'use client'

import React from "react"
import { LogOut } from "lucide-react"
import { useWalletStore } from "@/store/useWalletStore"

interface WalletHeaderProps {
  variant: "auth" | "dashboard"
  version?: string
}

export function WalletHeader({ variant, version = "v0.2.0" }: WalletHeaderProps) {
  const { lockWallet } = useWalletStore()
  const isDash = variant === "dashboard"
  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"

  const handleLogOut = () => {
    // ИСПРАВЛЕНИЕ 1: Вместо localStorage.clear() удаляем строго маркеры кошелька,
    // чтобы случайно не сбросить данные других скриптов на localhost:3000
    if (typeof window !== 'undefined') {
      localStorage.removeItem("xcha_mnemonic")
      localStorage.removeItem("xcha_is_auth")
    }
    
    // ИСПРАВЛЕНИЕ 2: Твой обновленный Zustand экшен lockWallet() 
    // теперь сам внутри себя безопасно очищает xcha-wallet-session и xcha_session_pin
    lockWallet()
    
    // Жесткий редирект на главную страницу авторизации
    window.location.href = "/"
  }

  return (
    <header className="flex items-center justify-between w-full pt-2 select-none">

      {/* ЛЕВАЯ КОЛОНКА: Одинаковый размер логотипа везде */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center bg-white text-black font-black text-sm px-3.5 py-1.5 rounded-xl tracking-tight shadow-md">
          XCH<span className="text-[#FF2E93]">A</span>
          <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#FF2E93] border border-zinc-950 ${isDash ? "animate-pulse" : ""
            }`} />
        </div>

        {isDash ? (
          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border transition-all duration-300 ${isTestnet ? "text-[#FF2E93] bg-[#FF2E93]/5 border-[#FF2E93]/20 shadow-sm shadow-[#FF2E93]/5" : "text-zinc-400 bg-zinc-900/60 border-zinc-800"
            }`}>
            {isTestnet ? "TESTNET 11" : "MAINNET"}
          </span>
        ) : (
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
            {version}
          </span>
        )}
      </div>

      {/* ПРАВАЯ КОЛОНКА */}
      {isDash ? (
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Онлайн
          </div>
          <button
            onClick={handleLogOut}
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
