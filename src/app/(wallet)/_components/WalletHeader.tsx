'use client'

import React from "react"
import Link from "next/link"
import { LogOut } from "lucide-react"

interface WalletHeaderProps {
  isClientReady: boolean;
  currentNetwork: string | null;
  statusText: string;
  statusBadgeClass: string;
  statusDotClass: string;
  showLogout: boolean;
  onLogout: () => void;
}

export const WalletHeader = React.memo(function WalletHeader({
  isClientReady,
  currentNetwork,
  statusText,
  statusBadgeClass,
  statusDotClass,
  showLogout,
  onLogout
}: WalletHeaderProps) {
  
  // Вычисляем состояние сети для безопасного дефолтного SSR-рендеринга
  const networkName = isClientReady && currentNetwork ? currentNetwork.toUpperCase() : "MAINNET"

  // Вычисляем стили статуса для безопасного дефолтного SSR-рендеринга (пока сокет молчит)
  const isRealStatusReady = isClientReady && statusText !== "Loading..."
  const activeStatusText = isRealStatusReady ? statusText : "Loading..."
  const activeBadgeClass = isRealStatusReady ? statusBadgeClass : "text-zinc-400 bg-zinc-800/40 border-zinc-700/50"
  const activeDotClass = isRealStatusReady ? statusDotClass : "bg-zinc-500"

  return (
    <header className="flex items-center justify-between w-full pt-2 select-none h-8">
      
      {/* ЛЕВАЯ КОЛОНКА: Брендинг и текущая сеть */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="relative flex items-center justify-center bg-zinc-900/40 border border-zinc-850 text-white font-black text-xs px-3.5 py-1.5 rounded-xl tracking-tight shadow-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/60 active:scale-[0.98] cursor-pointer"
        >
          XCH<span className="text-[#FF2E93]">A</span>
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#FF2E93] border border-zinc-950" />
        </Link>

        {/* Название сети: Всегда стабильный тег с дефолтным MAINNET во время гидратации */}
        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border text-zinc-500 bg-zinc-900/20 border-zinc-900 transition-opacity duration-300 ${!isClientReady ? 'opacity-50' : 'opacity-100'}`}>
          {networkName}
        </span>
      </div>

      {/* ПРАВАЯ КОЛОНКА: Статус сети и кнопка Logout */}
      <div className="flex items-center gap-2">
        
        {/* Кнопка статуса: Всегда отрендерена. Если статус неизвестен — пишет Loading... */}
        <Link
          href="/explorer/status"
          className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 ${activeBadgeClass}`}
          title="Open network status node monitor"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isRealStatusReady ? "animate-pulse" : ""} ${activeDotClass}`} />
          <span>{activeStatusText}</span>
        </Link>

        {/* Кнопка Logout: рендерится строго после проверки готовности клиента */}
        {showLogout && (
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer active:scale-95 animate-in fade-in duration-200"
          >
            <LogOut size={13} />
          </button>
        )}
      </div>

    </header>
  )
})
