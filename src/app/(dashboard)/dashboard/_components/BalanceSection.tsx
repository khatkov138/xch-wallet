'use client'

import React from "react"
import { RefreshCw } from "lucide-react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard" // Единый корневой хук

function formatStringBalance(xchString: string | number, decimals: number = 4): string {
  const str = String(xchString);
  if (!str.includes(".")) {
    return `${str}.${"0".repeat(decimals)}`;
  }
  const [integerPart, fractionalPart] = str.split(".");
  const safeFractional = fractionalPart || "";
  return `${integerPart}.${safeFractional.slice(0, decimals).padEnd(decimals, "0")}`;
}

export function BalanceSection() {
  // 🎯 ИСПРАВИЛИ: Убрали аргумент (true), так как хук теперь полностью автономный
  const { realXCHStr, numericXCH, error, refetch, isFetching } = useWalletDashboard()

  const balanceXCH = error ? "0.0000" : formatStringBalance(realXCHStr, 4)
  const balanceUSD = error
    ? "⚠️ Ошибка обновления данных"
    : `≈ $${(numericXCH * 2.00).toFixed(2)} USD`

  const isError = Boolean(error)

  return (
    <section className="text-center py-4 space-y-1 relative">
      <div className="absolute inset-0 m-auto w-32 h-16 bg-[#FF2E93]/10 blur-3xl pointer-events-none" />
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2 select-none">
        <span>Доступный баланс</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching} // Блокируем спам кликами, пока react-query обновляет кэш дашборда
          className={`text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer disabled:pointer-events-none ${
            isFetching ? "animate-spin text-[#FF2E93]" : ""
          }`}
        >
          <RefreshCw size={12} />
        </button>
      </p>

      <h2 className="text-4xl font-black tracking-tight text-white select-all">
        {balanceXCH} <span className="text-zinc-500 font-medium text-2xl">XCH</span>
      </h2>

      <p className={`text-xs font-bold transition-colors duration-200 ${isError ? "text-red-500" : "text-zinc-400"}`}>
        {balanceUSD}
      </p>
    </section>
  )
}
