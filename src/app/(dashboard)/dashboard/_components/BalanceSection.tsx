'use client'

import React from "react"
import { RefreshCw } from "lucide-react"
import { useWalletBalance } from "@/hooks/useWalletBalance"

function formatStringBalance(xchString: string | number, decimals: number = 4): string {
  const str = String(xchString);
  if (!str.includes(".")) return `${str}.${"0".repeat(decimals)}`;
  const [integerPart, fractionalPart] = str.split(".");
  return `${integerPart}.${fractionalPart.slice(0, decimals).padEnd(decimals, "0")}`;
}

export function BalanceSection() {
  // Просто вызываем наш чистый хук, никакой логики запросов внутри компонента!
  const { realXCHStr, numericXCH, error, refetch, isFetching } = useWalletBalance()

  const balanceXCH = error ? "0.0000" : formatStringBalance(realXCHStr, 4)
  const balanceUSD = error
    ? "⚠️ Ошибка: не удалось связаться с сервером"
    : `≈ $${(numericXCH * 2.00).toFixed(2)} USD`

  const isError = Boolean(error)

  return (
    <section className="text-center py-4 space-y-1 relative">
      <div className="absolute inset-0 m-auto w-32 h-16 bg-[#FF2E93]/10 blur-3xl pointer-events-none" />
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2 select-none">
        <span>Доступный баланс</span>
        <button
          onClick={() => refetch()}
          className={`text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer ${
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
