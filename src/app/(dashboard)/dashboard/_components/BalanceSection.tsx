'use client'

import React from "react"
import { RefreshCw } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { handleApi } from "@/lib/utils"
import { BalanceData } from "@/app/types/chia"

interface BalanceSectionProps {
  currentAddress: string
}

export function BalanceSection({ currentAddress }: BalanceSectionProps) {
  // Запрос баланса живет прямо внутри компонента
  const { data: balanceData, error: balanceError, refetch, isFetching } = useQuery<BalanceData>({
    queryKey: ['walletBalance', currentAddress],
    queryFn: () => handleApi<BalanceData>(fetch(`/api/chia/balance?address=${currentAddress}`)),
    enabled: !!currentAddress,
    refetchInterval: 10000, // Поллинг баланса каждые 10 секунд
    staleTime: 5000,
  })

  const realXCH = balanceData?.xch ?? 0

  // УМНАЯ СТАТИЧЕСКАЯ МАСКИРОВКА ОШИБКИ ВНУТРИ КОМПОНЕНТА
  const balanceXCH = balanceError ? "0.0000" : realXCH.toFixed(4)
  const balanceUSD = balanceError
    ? "⚠️ Ошибка: не удалось связаться с сервером"
    : `≈ $${(realXCH * 2.00).toFixed(2)} USD`

  const isError = balanceUSD.includes("Ошибка")

  return (
    <section className="text-center py-4 space-y-1 relative">
      <div className="absolute inset-0 m-auto w-32 h-16 bg-[#FF2E93]/10 blur-3xl pointer-events-none" />
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2 select-none">
        <span>Доступный баланс</span>
        <button
          onClick={() => refetch()}
          className={`text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer ${isFetching ? "animate-spin text-[#FF2E93]" : ""
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
