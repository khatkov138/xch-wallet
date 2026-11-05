'use client'

import { useMemo } from "react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { useQuery } from "@tanstack/react-query"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

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
  
  // Атомарные селекторы Zustand для стабильности React 19
  const currency = useUserSettingsStore((state) => state.currency)
  const setCurrency = useUserSettingsStore((state) => state.setCurrency)

  const { data: marketData, isError: isPriceError, isLoading: isPriceLoading } = useQuery<PricesResponse, Error>({
    queryKey: ["xchMarketPriceNextRouter"],
    queryFn: async () => {
      const res = await fetch(INTERNAL_NEXT_PRICES_API);
      if (!res.ok) throw new Error("Internal Next.js price route unavailable");
      return res.json();
    },
    staleTime: 15000, 
    gcTime: 30000
  });

  const isNodeError = Boolean(error)
  const isError = isNodeError || isPriceError

  // Если ошибка ноды — жестко выводим 0.0000
  const balanceXCH = isNodeError ? "0.0000" : formatStringBalance(realXCHStr, 4)

  // 🎯 Флаг для скелетона в твоем UI (идет загрузка ноды или цены)
  const isLoading = isFetching && (!marketData || isNodeError)

  const fiatBalanceString = useMemo(() => {
    // 🛠️ Если произошел сбой — отдаем красивый дефолт 0.00 в выбранной валюте
    if (isError || !marketData) {
      return currency === "RUB" ? "≈ 0.00 ₽" : "≈ $0.00 USD"
    }
    
    const usdPrice = marketData.usd || 0
    const rubPrice = marketData.rub || 0
    
    if (currency === "RUB") {
      const valueInRub = numericXCH * rubPrice
      return `≈ ${valueInRub.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
    } else {
      const valueInUsd = numericXCH * usdPrice
      return `≈ $${valueInUsd.toFixed(2)} USD`
    }
  }, [isError, currency, numericXCH, marketData])

  const toggleCurrency = () => {
    if (!isNodeError) {
      setCurrency(currency === "RUB" ? "USD" : "RUB")
    }
  }

  return {
    balanceXCH,
    numericXCH,
    fiatBalanceString,
    currency,
    isError,
    isLoading, // ⚡ Прокидываем наружу для рендера скелетонов
    isFetching,
    refetch,
    toggleCurrency
  }
}
