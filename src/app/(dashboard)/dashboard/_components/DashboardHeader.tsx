'use client'

import React from "react"
import { LogOut } from "lucide-react"

export function DashboardHeader() {
  // Считываем булев флаг сети из файла .env.local
  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"

  const handleLogOut = () => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = "/"
  }

  return (
    <header className="flex items-center justify-between w-full pt-2">
      {/* Левый блок: Логотип + Динамический индикатор сети */}
      <div className="flex items-center gap-2">
        <div className="bg-white text-black font-black text-sm px-3 py-1.5 rounded-xl tracking-tight shadow-md select-none">
          XCH<span className="text-[#FF2E93]">A</span>
        </div>
        
        {/* Динамический бейдж сети */}
        <span 
          className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border transition-all select-none duration-300 ${
            isTestnet
              ? "text-[#FF2E93] bg-[#FF2E93]/5 border-[#FF2E93]/20 shadow-sm shadow-[#FF2E93]/5"
              : "text-zinc-400 bg-zinc-900/60 border-zinc-800"
          }`}
        >
          {isTestnet ? "TESTNET 11" : "MAINNET"}
        </span>
      </div>
      
      {/* Правый блок: Статус ноды + Кнопка Выхода */}
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 select-none">
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
    </header>
  )
}
