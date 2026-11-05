'use client'

import React from "react"
import { RefreshCw } from "lucide-react"
import { useWalletBalance } from "@/hooks/useWalletBalance"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

export function BalanceSection() {
  const { 
    balanceXCH, 
    fiatValue, // 🔢 Принимаем чистое число вместо fiatBalanceString
    currency,  // 💱 Принимаем выбранную валюту ('RUB' | 'USD')
    isError, 
    isFetching, 
    refetch 
  } = useWalletBalance()

  // Достаем состояние сети, текущий статус отображения и сеттер из глобального стора
  const network = useUserSettingsStore((state) => state.network)
  const balanceDisplay = useUserSettingsStore((state) => state.balanceDisplay)
  const setBalanceDisplay = useUserSettingsStore((state) => state.setBalanceDisplay)

 //console.log(balanceDisplay,"balanceDisplay" )
  const isXchTop = balanceDisplay === 'xch'
  const isMainnet = network === 'mainnet'
  const xchTicker = isMainnet ? 'XCH' : 'TXCH'

  // Функция для смены мест через глобальный стор
  const handleSwap = () => {
    setBalanceDisplay(isXchTop ? 'fiat' : 'xch')
  }

  return (
    <section className="text-center py-4 relative flex flex-col items-center">
      <div className="absolute inset-0 m-auto w-32 h-16 bg-[#FF2E93]/10 blur-3xl pointer-events-none" />
      
      {/* Шапка баланса */}
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2 select-none mb-1">
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

      {/* КОНТЕЙНЕР С РОДНЫМИ ОТСТУПАМИ (h-[72px] держит внешние границы, а внутри родной space-y-1) */}
      <div className={`flex flex-col w-full h-[72px] justify-center items-center ${
        isXchTop 
          ? "flex-col space-y-1" 
          : "flex-col-reverse space-y-reverse space-y-1"
      }`}>
        
        {/* БЛОК XCH */}
        <div 
          onClick={isXchTop ? handleSwap : undefined}
          className={`tracking-tight text-white select-none transition-all duration-150 ${
            isXchTop 
              ? "text-4xl font-black cursor-pointer active:scale-98" 
              : "text-xs font-bold text-zinc-400"
          }`}
          title={isXchTop ? "Поменять валюты местами" : undefined}
        >
          {balanceXCH}{" "}
          <span className={`font-medium transition-colors duration-150 ${isXchTop ? "text-2xl text-zinc-500" : "text-[10px] text-zinc-500"}`}>
            {xchTicker}
          </span>
        </div>

        {/* БЛОК ФИАТА */}
        <div 
          onClick={!isXchTop ? handleSwap : undefined}
          suppressHydrationWarning={true} // 🚀 Гарантирует тишину при несовпадении локалей SSR и браузера
          className={`transition-all duration-150 select-none ${
            isError ? "text-red-500" : ""
          } ${
            isXchTop 
              ? "text-xs font-bold text-zinc-400" 
              : "text-4xl font-black text-white cursor-pointer active:scale-98"
          }`}
          title={!isXchTop ? "Поменять валюты местами" : undefined}
        >
          {/* 💎 Рендерим локализованную строку прямо в интерфейсе на основе чистых данных */}
          {currency === "RUB" ? (
            `≈ ${fiatValue.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
          ) : (
            `≈ $${fiatValue.toFixed(2)} USD`
          )}
        </div>

      </div>
    </section>
  )
}
