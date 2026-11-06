'use client'

import { useQuery } from "@tanstack/react-query"
import { useWalletSessionStore } from "@/store/useWalletSessessionStore"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

export function useWalletDashboard() {
  const unhardenedPkHex = useWalletSessionStore((state: any) => state.unhardenedPkHex)
  const activeIndexes = useWalletSessionStore((state: any) => state.activeIndexes)
  const setActiveIndexes = useWalletSessionStore((state: any) => state.setActiveIndexes)
  const isVerifying = useWalletSessionStore((state: any) => state.isVerifying)
  const isScreenLocked = useWalletSessionStore((state: any) => state.isScreenLocked)
  
  const network = useUserSettingsStore((state: any) => state.network)

  const queryKey = ["wallet-dashboard", network, unhardenedPkHex, activeIndexes]
  const currentMode = !activeIndexes ? "heavy" : "light"

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
      const res = await fetch(`/api/wallet/dashboard?${params.toString()}`)
      if (!res.ok) throw new Error("Sync failed")
      
      const data = await res.json()

      // Попутно проверяем индексы кошелька при успешном ответе сервера
      if (data?.meta?.active_indexes) {
        const freshIndexesStr = data.meta.active_indexes.join(",")
        if (freshIndexesStr !== activeIndexes && typeof setActiveIndexes === "function") {
          setTimeout(() => setActiveIndexes(freshIndexesStr), 0)
        }
      }

      return data
    },
    enabled: !isVerifying && !isScreenLocked && !!unhardenedPkHex,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 100000, // Автополлинг раз в 1000 секунд
    refetchIntervalInBackground: false,
  })

  // Вытаскиваем балансы напрямую из кэша данных TanStack Query
  const realXCHStr = query.data?.balance?.total_xch ?? "0.0000"
  const numericXCH = Number(realXCHStr)
  const unspentCoins = query.data?.unspent_coins ?? []
  const addresses = query.data?.balance?.addresses ?? []
  const transactions = query.data?.transactions ?? []

  return {
    queryKey, 
    realXCHStr,
    numericXCH,
    addresses,       
    transactions,    
    unspentCoins, // Сюда мутация сама подмешает монеты с флагом isLocked: true
    balance: query.data?.balance ?? null, 
    error: query.error,
    isFetching: query.isFetching,
    isLoading: query.isLoading || !query.data,
    refetch: query.refetch,
  }
}
