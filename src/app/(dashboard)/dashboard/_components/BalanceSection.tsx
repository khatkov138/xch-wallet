'use client'

import React, { useState } from "react"
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
  const { realXCHStr, numericXCH, error, refetch, isFetching } = useWalletDashboard()

  // 🎯 СТЕЙТ ВАЛЮТЫ: по дефолту RUB, переключается на USD
  const [currency, setCurrency] = useState<"RUB" | "USD">("RUB")

  // Актуальные курсы на конец 2026 года: 1 XCH ≈ $14.80 USD, $1 USD ≈ 100 RUB
  const PRICE_XCH_USD = 1.3
  const USD_TO_RUB = 82.00
  const PRICE_XCH_RUB = PRICE_XCH_USD * USD_TO_RUB // ≈ 1480 руб за 1 XCH

  const balanceXCH = error ? "0.0000" : formatStringBalance(realXCHStr, 4)

  // Расчет фиатного баланса в зависимости от выбранной валюты
  const getFiatBalanceString = () => {
    if (error) return "⚠️ Ошибка обновления данных"
    
    if (currency === "RUB") {
      const valueInRub = numericXCH * PRICE_XCH_RUB
      return `≈ ${valueInRub.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
    } else {
      const valueInUsd = numericXCH * PRICE_XCH_USD
      return `≈ $${valueInUsd.toFixed(2)} USD`
    }
  }

  const isError = Boolean(error)

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
        {balanceXCH} <span className="text-zinc-500 font-medium text-2xl">XCH</span>
      </h2>

      {/* 🎯 КЛИКАБЕЛЬНАЯ СТРОКА: Переключает валюту RUB <-> USD, дизайн полностью сохранен */}
      <p 
        onClick={() => !isError && setCurrency(currency === "RUB" ? "USD" : "RUB")}
        className={`text-xs font-bold transition-colors duration-200 select-none ${
          isError ? "text-red-500" : "text-zinc-400 hover:text-white cursor-pointer active:scale-98 transition-all"
        }`}
        title="Нажмите для переключения валюты (RUB / USD)"
      >
        {getFiatBalanceString()}
      </p>
    </section>
  )
}
