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

  // 🎯 ОПРЕДЕЛЯЕМ РЕЖИМ НА ОСНОВЕ НАЛИЧИЯ ИНДЕКСОВ В СТОРЕ
  // Если индексов в Zustand еще нет — запускаем heavy (первичный глубокий скан)
  const currentMode = !activeIndexes ? "heavy" : "light"

  const query = useQuery<any>({
    // В queryKey оставляем только ключ кошелька, чтобы изменение activeIndexes
    // не вызывало жесткого сброса кэша и мерцания интерфейса
    queryKey: ["wallet-dashboard", unhardenedPkHex],
    queryFn: async () => {
      const params = new URLSearchParams({
        publicKeyHex: unhardenedPkHex,
        mode: currentMode,
        limit: "200",
        ...(activeIndexes && { active_indexes: activeIndexes })
      })
      
      console.log(`📡 [API TRIGGER] Запрос отправлен! Сеть качает в режиме: ${currentMode.toUpperCase()}`)

      // 🎯 ТОЧКА ВХОДА: Перевели на относительный путь через наш рабочий Next.js прокси (порт 3000)
      const res = await fetch(`/api/wallet/dashboard?${params.toString()}`)
      if (!res.ok) throw new Error("Sync failed")
      
      return await res.json()
    },
    enabled: isReadyToFetch,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false
  })

  // 🎯 СИНХРОНИЗАЦИЯ АКТИВНЫХ ИНДЕКСОВ БЕЗ ЦИКЛИЧЕСКОЙ ЗАВИСИМОСТИ
  // Обновляем стор Zustand строго ПОСЛЕ завершения запроса и только если данные реально изменились
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
    addresses,       // 🎯 Массив адресов с address_pubkey_hex внутри
    transactions,
    unspentCoins,    // 🎯 Оптимизированный легкий список монет
    balance: query.data?.balance ?? null, 
    error: query.error,
    isFetching: query.isFetching,
    isLoading: query.isLoading || !query.data,
    refetch: query.refetch,
  }
}
