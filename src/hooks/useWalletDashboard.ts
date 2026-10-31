'use client'

import { useQuery } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore"

export function useWalletDashboard() {
  const unhardenedPkHex = useWalletSession((state: any) => state.unhardenedPkHex)
  const activeIndexes = useWalletSession((state: any) => state.activeIndexes)
  const setActiveIndexes = useWalletSession((state: any) => state.setActiveIndexes)
  const isVerifying = useWalletSession((state: any) => state.isVerifying)
  const isScreenLocked = useWalletSession((state: any) => state.isScreenLocked)

  const isReadyToFetch = !isVerifying && !isScreenLocked && !!unhardenedPkHex

  const query = useQuery<any>({
    queryKey: ["wallet-dashboard", unhardenedPkHex, activeIndexes],
    queryFn: async () => {
      const isInitialLoad = !query.data
      const currentMode = isInitialLoad ? "heavy" : "light"

      const params = new URLSearchParams({
        publicKeyHex: unhardenedPkHex,
        mode: currentMode,
        limit: "200",
        ...(!isInitialLoad && { active_indexes: activeIndexes })
      })
      
      console.log(`📡 [API TRIGGER] Запрос отправлен! Сеть качает в режиме: ${currentMode.toUpperCase()}`)

      const res = await fetch(`http://localhost:8000/api/wallet/dashboard?${params.toString()}`)
      if (!res.ok) throw new Error("Sync failed")
      const json = await res.json()
      
      if (json.meta?.active_indexes) {
        setActiveIndexes(json.meta.active_indexes.join(","))
      }
      return json
    },
    enabled: isReadyToFetch,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false
  })

  const realXCHStr = query.data?.balance?.total_xch ?? "0.0000"
  const numericXCH = Number(realXCHStr)
  const addresses = query.data?.balance?.addresses ?? []
  const transactions = query.data?.transactions ?? []
  const unspentCoins = query.data?.unspent_coins ?? [] // 🎯 ДОБАВИЛИ: вытаскиваем купюры из кэша

  return {
    realXCHStr,
    numericXCH,
    addresses,
    transactions,
    unspentCoins, // 🎯 ДОБАВИЛИ: отдаем модалкам
    error: query.error,
    isFetching: query.isFetching,
    isLoading: query.isLoading || !query.data,
    refetch: query.refetch,
  }
}
