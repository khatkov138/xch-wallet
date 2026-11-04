'use client'

import React from "react"
import { RefreshCw } from "lucide-react"
import { useWalletBalance } from "@/hooks/useWalletBalance"
import { useWalletSession } from "@/store/useWalletStore"

export function BalanceSection() {
  const { 
    balanceXCH, 
    fiatBalanceString, 
    isError, 
    isFetching, 
    refetch, 
    toggleCurrency 
  } = useWalletBalance()

  // Достаем состояние сети из твоего глобального стора
  const network = useWalletSession((state) => state.network)
  const isMainnet = network === 'mainnet'

  return (
    <section className="text-center py-4 space-y-1 relative">
      <div className="absolute inset-0 m-auto w-32 h-16 bg-[#FF2E93]/10 blur-3xl pointer-events-none" />
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2 select-none">
        <span>Доступный баланс</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={`text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer disabled:pointer-events-none ${
            isFetching ? "animate-spin text-[#FF2E93]" : ""
          }`}
        >
          <RefreshCw size={12} />
        </button>
      </p>

      <h2 className="text-4xl font-black tracking-tight text-white select-all">
        {balanceXCH} <span className="text-zinc-500 font-medium text-2xl transition-colors duration-150">
          {isMainnet ? 'XCH' : 'TXCH'}
        </span>
      </h2>

      <p 
        onClick={toggleCurrency}
        className={`text-xs font-bold transition-colors duration-200 select-none ${
          isError ? "text-red-500" : "text-zinc-400 hover:text-white cursor-pointer active:scale-98 transition-all"
        }`}
        title="Нажмите для переключения валюты (RUB / USD)"
      >
        {fiatBalanceString}
      </p>
    </section>
  )
}
