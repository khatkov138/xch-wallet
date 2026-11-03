'use client'

import { useState, useMemo } from "react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"

// Вспомогательная функция форматирования строки баланса
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
  const [currency, setCurrency] = useState<"RUB" | "USD">("RUB")

  // Актуальные курсы: 1 XCH ≈ $1.3 USD, $1 USD ≈ 82.00 RUB
  const PRICE_XCH_USD = 1.3
  const USD_TO_RUB = 82.00
  const PRICE_XCH_RUB = PRICE_XCH_USD * USD_TO_RUB

  const isError = Boolean(error)
  const balanceXCH = isError ? "0.0000" : formatStringBalance(realXCHStr, 4)

  // Мемоизированный расчет фиатной строки
  const fiatBalanceString = useMemo(() => {
    if (isError) return "⚠️ Ошибка обновления данных"
    
    if (currency === "RUB") {
      const valueInRub = numericXCH * PRICE_XCH_RUB
      return `≈ ${valueInRub.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
    } else {
      const valueInUsd = numericXCH * PRICE_XCH_USD
      return `≈ $${valueInUsd.toFixed(2)} USD`
    }
  }, [isError, currency, numericXCH, PRICE_XCH_RUB, PRICE_XCH_USD])

  const toggleCurrency = () => {
    if (!isError) {
      setCurrency((prev) => (prev === "RUB" ? "USD" : "RUB"))
    }
  }

  return {
    balanceXCH,
    numericXCH,
    fiatBalanceString,
    currency,
    isError,
    isFetching,
    refetch,
    toggleCurrency
  }
}
