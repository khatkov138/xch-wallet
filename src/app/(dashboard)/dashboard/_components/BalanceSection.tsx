'use client'

import React from "react"
import { RefreshCw } from "lucide-react"

interface BalanceSectionProps {
  balanceXCH: string
  balanceUSD: string
  isRefreshing: boolean
  onRefresh: () => void 
}

export function BalanceSection({ balanceXCH, balanceUSD, isRefreshing, onRefresh }: BalanceSectionProps) {
  // Динамически проверяем, прилетела ли ошибка, чтобы покрасить её
  const isError = balanceUSD.includes("Ошибка")

  return (
    <section className="text-center py-4 space-y-1 relative">
      <div className="absolute inset-0 m-auto w-32 h-16 bg-[#FF2E93]/10 blur-3xl pointer-events-none" />
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2 select-none">
        <span>Доступный баланс</span>
        <button 
          onClick={onRefresh}
          className={`text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer ${
            isRefreshing ? "animate-spin text-[#FF2E93]" : ""
          }`}
        >
          <RefreshCw size={12} />
        </button>
      </p>
      
      {/* СТРОГО ТВОИ ОРИГИНАЛЬНЫЕ ШРИФТЫ И КЛАССЫ БЕЗ ИЗМЕНЕНИЙ */}
      <h2 className="text-4xl font-black tracking-tight text-white select-all">
        {balanceXCH} <span className="text-zinc-500 font-medium text-2xl">XCH</span>
      </h2>
      
      {/* Твоя строчка, которая плавно переключается на красный цвет только при ошибке */}
      <p className={`text-xs font-bold transition-colors duration-200 ${isError ? "text-red-500" : "text-zinc-400"}`}>
        {balanceUSD}
      </p>
    </section>
  )
}
