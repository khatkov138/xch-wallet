'use client'

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore"

export function useWalletDashboard() {
  const unhardenedPkHex = useWalletSession((state: any) => state.unhardenedPkHex)
  const activeIndexes = useWalletSession((state: any) => state.activeIndexes)
  const setActiveIndexes = useWalletSession((state: any) => state.setActiveIndexes)
  const isVerifying = useWalletSession((state: any) => state.isVerifying)
  const isScreenLocked = useWalletSession((state: any) => state.isScreenLocked)

  const isReadyToFetch = !isVerifying && !isScreenLocked && !!unhardenedPkHex
  const currentMode = !activeIndexes ? "heavy" : "light"

  const query = useQuery({
    // 🎯 ФИКС 1: Добавили activeIndexes в queryKey. 
    // Теперь при переходе heavy -> light запрос мгновенно реагирует на смену аргументов.
    queryKey: ["wallet-dashboard", unhardenedPkHex, activeIndexes],
    queryFn: async () => {
      const params = new URLSearchParams({
        publicKeyHex: unhardenedPkHex,
        mode: currentMode,
        limit: "200",
        ...(activeIndexes && { active_indexes: activeIndexes })
      })
      
      console.log(`📡 [API TRIGGER] Запрос отправлен! Сеть качает в режиме: ${currentMode.toUpperCase()}`)

      const res = await fetch(`/api/wallet/dashboard?${params.toString()}`)
      if (!res.ok) throw new Error("Sync failed")
      
      return await res.json()
    },
    enabled: isReadyToFetch,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false,
    
    // 🎯 ФИКС 2: SELECT-MEMOIZATION. Через встроенный Structural Sharing в TanStack Query v5 
    // ссылки на массивы внутри data останутся прежними, если бэк вернул те же данные. Ререндеров в Layout нет.
    select: (data) => data
  })

  // 🎯 СИНХРОНИЗАЦИЯ АКТИВНЫХ ИНДЕКСОВ БЕЗ ЦИКЛИЧЕСКОЙ ЗАВИСИМОСТИ
  useEffect(() => {
    if (query.data?.meta?.active_indexes) {
      const freshIndexesStr = query.data.meta.active_indexes.join(",")
      if (freshIndexesStr !== activeIndexes) {
        setActiveIndexes(freshIndexesStr)
      }
    }
  }, [query.data?.meta?.active_indexes, activeIndexes, setActiveIndexes])

  const realXCHStr = query.data?.balance?.total_xch ?? "0.0000"
  const numericXCH = Number(realXCHStr)
  const addresses = query.data?.balance?.addresses ?? []
  const transactions = query.data?.transactions ?? []
  const unspentCoins = query.data?.unspent_coins ?? [] 

  return {
    realXCHStr,
    numericXCH,
    addresses,       // Стабильная ссылка благодаря select-паттерну
    transactions,    // Стабильная ссылка
    unspentCoins,    // Стабильная ссылка
    balance: query.data?.balance ?? null, 
    error: query.error,
    isFetching: query.isFetching,
    isLoading: query.isLoading || !query.data,
    refetch: query.refetch,
  }
}
