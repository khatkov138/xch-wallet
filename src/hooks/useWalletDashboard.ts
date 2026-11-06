'use client'

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

import { useWalletSessionStore } from "@/store/useWalletSessessionStore"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

export function useWalletDashboard() {
  // Читаем данные авторизации из сессии
  const unhardenedPkHex = useWalletSessionStore((state: any) => state.unhardenedPkHex)
  const activeIndexes = useWalletSessionStore((state: any) => state.activeIndexes)
  const setActiveIndexes = useWalletSessionStore((state: any) => state.setActiveIndexes)
  const isVerifying = useWalletSessionStore((state: any) => state.isVerifying)
  const isScreenLocked = useWalletSessionStore((state: any) => state.isScreenLocked)
  
  // 🎯 Читаем активную сеть из стора настроек пользователя (localStorage)
  const network = useUserSettingsStore((state: any) => state.network)

  const isReadyToFetch = !isVerifying && !isScreenLocked && !!unhardenedPkHex
  const currentMode = !activeIndexes ? "heavy" : "light"

  // 🎯 КАНОНИЧЕСКИЙ КЛЮЧ КЭША (Экспортируем его для мутации отправки)
  const queryKey = ["wallet-dashboard", network, unhardenedPkHex, activeIndexes]

  const query = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        publicKeyHex: unhardenedPkHex,
        network: network,
        mode: currentMode,
        limit: "200",
        ...(activeIndexes && { active_indexes: activeIndexes })
      })
      
      console.log(`📡 [API TRIGGER] Запрос [${network.toUpperCase()}]! Режим: ${currentMode.toUpperCase()}`)

      const res = await fetch(`/api/wallet/dashboard?${params.toString()}`)
      if (!res.ok) throw new Error("Sync failed")
      
      return await res.json()
    },
    enabled: isReadyToFetch,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false,
    select: (data) => data
  })

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
    queryKey, // 🌟 Пробрасываем ключ наружу для точечных инвалидаций в мутациях
    realXCHStr,
    numericXCH,
    addresses,       
    transactions,    
    unspentCoins,    
    balance: query.data?.balance ?? null, 
    error: query.error,
    isFetching: query.isFetching,
    isLoading: query.isLoading || !query.data,
    refetch: query.refetch,
  }
}
