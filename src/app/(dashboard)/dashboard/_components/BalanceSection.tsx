'use client'

import React from "react"
import { RefreshCw } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { handleApi } from "@/lib/utils"
import { useWalletAuth } from "@/hooks/useWalletAuth"

interface IndexRecord { index: number; puzzle_hash: string; xch: string; mojo: string; coins: any[]; }
interface MultiIndexBalanceData { total_xch: string; total_mojo: string; addresses: IndexRecord[]; }

function formatStringBalance(xchString: string | number, decimals: number = 4): string {
  const str = String(xchString);
  if (!str.includes(".")) {
    return `${str}.${"0".repeat(decimals)}`;
  }
  
  const [integerPart, fractionalPart] = str.split(".");
  const truncatedFraction = fractionalPart.slice(0, decimals);
  
  const paddedFraction = truncatedFraction.padEnd(decimals, "0");
  
  return `${integerPart}.${paddedFraction}`;
}

export function BalanceSection() {
  // Достаем метод получения публичного ключа кошелька прямо из твоего хука авторизации
  const { getUnhardenedPkHex } = useWalletAuth()
  const walletPublicKeyHex = getUnhardenedPkHex()

  const { data: balanceData, error: balanceError, refetch, isFetching } = useQuery<MultiIndexBalanceData>({
    queryKey: ['walletBalance', walletPublicKeyHex],
    queryFn: () => handleApi<MultiIndexBalanceData>(fetch(`/api/wallet/balance?publicKeyHex=${walletPublicKeyHex}`)),
    enabled: !!walletPublicKeyHex,
    refetchInterval: 10000,
    staleTime: 5000,
  })

  const realXCHStr = balanceData?.total_xch ?? "0"

  const balanceXCH = balanceError ? "0.0000" : formatStringBalance(realXCHStr, 4)
  
  const numericXCH = Number(realXCHStr)
  const balanceUSD = balanceError
    ? "⚠️ Ошибка: не удалось связаться с сервером"
    : `≈ $${(numericXCH * 2.00).toFixed(2)} USD`

  const isError = balanceUSD.includes("Ошибка")

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
