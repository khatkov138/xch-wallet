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
  // 🔐 realXCHStr и numericXCH теперь рассчитываются с учетом: isSpent (считаем) и isLocked (не считаем)
  const { realXCHStr, numericXCH, error, refetch, isFetching } = useWalletDashboard()
  
  const currency = useUserSettingsStore((state) => state.currency)
  const setCurrency = useUserSettingsStore((state) => state.setCurrency)

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

  const isNodeError = Boolean(error)
  const isError = isNodeError || isPriceError

  const balanceXCH = isNodeError ? "0.0000" : formatStringBalance(realXCHStr, 4)
  const isLoading = isFetching && (!marketData || isNodeError)

  // 🎯 ВЫЧИСЛЯЕМ ТОЛЬКО ЧИСЛО: Никаких знаков валют и кастомных нулей текстом
  const fiatValue = useMemo(() => {
    if (isError || !marketData) return 0
    
    const usdPrice = marketData.usd || 0
    const rubPrice = marketData.rub || 0
    
    return currency === "RUB" ? numericXCH * rubPrice : numericXCH * usdPrice
  }, [isError, currency, numericXCH, marketData])

  const toggleCurrency = () => {
    if (!isNodeError) {
      setCurrency(currency === "RUB" ? "USD" : "RUB")
    }
  }

  return {
    balanceXCH,
    numericXCH,
    fiatValue, // 🔢 Чистое фиатное число
    currency,
    isError,
    isLoading, 
    isFetching,
    refetch,
    toggleCurrency
  }
}
