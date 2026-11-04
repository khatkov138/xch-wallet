'use client'

import { useMemo } from "react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"

import { useQuery } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore"

const INTERNAL_NEXT_PRICES_API = "/api/nextjs/prices"

interface PricesResponse {
  success: boolean;
  source: string;
  usd: number;
  rub: number;
}

export function formatStringBalance(xchString: string | number, decimals: number = 4): string {
  const str = String(xchString);
  if (!str.includes(".")) {
    return `${str}.${"0".repeat(decimals)}`;
  }
  const [integerPart, fractionalPart] = str.split(".");
  const safeFractional = fractionalPart || "";
  return `${integerPart}.${safeFractional.slice(0, decimals).padEnd(decimals, "0")}`;
}

export function useWalletBalance() {
  const { realXCHStr, numericXCH, error, refetch, isFetching } = useWalletDashboard()
  
  // 🎯 Подключаем глобальный Zustand стор вместо локального useState
  const currency = useWalletSession((state) => state.currency)
  const setCurrency = useWalletSession((state) => state.setCurrency)

  const { data: marketData, isError: isPriceError } = useQuery<PricesResponse, Error>({
    queryKey: ["xchMarketPriceNextRouter"],
    queryFn: async () => {
      const res = await fetch(INTERNAL_NEXT_PRICES_API);
      if (!res.ok) throw new Error("Internal Next.js price route unavailable");
      return res.json();
    },
    staleTime: 15000, 
    gcTime: 30000
  });

  const isError = Boolean(error)
  const balanceXCH = isError ? "0.0000" : formatStringBalance(realXCHStr, 4)

  const fiatBalanceString = useMemo(() => {
    if (isError) return "⚠️ Ошибка обновления данных"
    
    const usdPrice = marketData?.usd || 0
    const rubPrice = marketData?.rub || 0
    
    if (currency === "RUB") {
      const valueInRub = numericXCH * rubPrice
      return `≈ ${valueInRub.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
    } else {
      const valueInUsd = numericXCH * usdPrice
      return `≈ $${valueInUsd.toFixed(2)} USD`
    }
  }, [isError, currency, numericXCH, marketData])

  // 🎯 Переключаем глобально, состояние автоматически обновится во всем приложении
  const toggleCurrency = () => {
    if (!isError) {
      setCurrency(currency === "RUB" ? "USD" : "RUB")
    }
  }

  return {
    balanceXCH,
    numericXCH,
    fiatBalanceString,
    currency,
    isError: isError || isPriceError,
    isFetching,
    refetch,
    toggleCurrency
  }
}
