'use client'

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useWalletSessionStore } from "@/store/useWalletSessessionStore"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

export function useWalletDashboard() {
  const queryClient = useQueryClient()
  
  // 🔐 Атомарные селекторы авторизации из сессии
  const unhardenedPkHex = useWalletSessionStore((state: any) => state.unhardenedPkHex)
  const activeIndexes = useWalletSessionStore((state: any) => state.activeIndexes)
  const setActiveIndexes = useWalletSessionStore((state: any) => state.setActiveIndexes)
  const isVerifying = useWalletSessionStore((state: any) => state.isVerifying)
  const isScreenLocked = useWalletSessionStore((state: any) => state.isScreenLocked)
  
  // 🎯 Активная сеть из настроек (mainnet / testnet11)
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

      console.log(`📡 [API TRIGGER] Поллинг [${network.toUpperCase()}] | Режим: ${currentMode.toUpperCase()}`)
      const res = await fetch(`/api/wallet/dashboard?${params.toString()}`)
      if (!res.ok) throw new Error("Sync failed")
      
      const serverData = await res.json()

      // 🔄 ЖЕЛЕЗОБЕТОННАЯ СИНХРОНИЗАЦИЯ КЭША ПРИ АВТОПОЛЛИНГЕ РАЗ В 10 СЕКУНД
      const previousCache: any = queryClient.getQueryData(queryKey)
      
      if (previousCache && serverData) {
        // Собираем Set всех живых coin_id, которые нода сейчас вернула официально в нижнем регистре
        const serverCoinIds = new Set(
          (serverData.unspent_coins || []).map((c: any) => String(c?.coin_id ?? "").toLowerCase())
        )
        
        // 1. Удерживаем активную оптимистичную сдачу (isLocked), пока её физически нет в ответе сервера
        const activeOptimisticCoins = (previousCache.unspent_coins || []).filter(
          (c: any) => c.isLocked === true && !serverCoinIds.has(String(c?.coin_id ?? "").toLowerCase())
        )

        // 2. Удерживаем spent-флаги старых сжигаемых монет, если сервер всё еще продолжает их присылать
        const spentCoinIdsFromCache = new Set(
          (previousCache.unspent_coins || [])
            .filter((c: any) => c.isSpent === true)
            .map((c: any) => String(c?.coin_id ?? "").toLowerCase())
        )

        const updatedServerCoins = (serverData.unspent_coins || []).map((item: any) => {
          const cId = String(item?.coin_id ?? "").toLowerCase()
          if (spentCoinIdsFromCache.has(cId)) {
            return { ...item, isSpent: true } // Принудительно держим метку списания, пока блок не замайнится
          }
          return item
        })

        // Склеиваем отфильтрованный серверный пул и не подтвержденную сдачу
        serverData.unspent_coins = [...updatedServerCoins, ...activeOptimisticCoins]

        // 3. УДЕРЖИВАЕМ PENDING-ТРАНЗАКЦИИ В ИСТОРИИ ДО МОМЕНТА ИХ ОФИЦИАЛЬНОГО ВКЛЮЧЕНИЯ В БЛОК
        const serverTxIds = new Set(
          (serverData.transactions || []).map((tx: any) => String(tx?.tx_id ?? "").toLowerCase())
        )
        
        const pendingTransactions = (previousCache.transactions || []).filter(
          (tx: any) => tx.status === "pending" && !serverTxIds.has(String(tx?.tx_id ?? "").toLowerCase())
        )

        // Склеиваем: сначала висящие мемпул транзы, затем свежая подтвержденная история от сервера
        serverData.transactions = [...pendingTransactions, ...(serverData.transactions || [])].slice(0, 50)

        // 4. ПЕРЕСЧЕТ ОПТИМИСТИЧНОГО БАЛАНСА: сдача (isLocked) — считаем, потраченные инпуты (isSpent) — НЕ считаем
        const totalMojos = serverData.unspent_coins.reduce((acc: bigint, item: any) => {
          if (item?.isSpent === true) return acc // Игнорируем сожженную родительскую UTXO монету
          
          const rawAmount = item?.coin?.amount
          return rawAmount !== undefined && rawAmount !== null ? acc + BigInt(rawAmount) : acc
        }, BigInt(0))

        serverData.balance.total_xch = (Number(totalMojos) / 1_000_000_000_000).toFixed(4)
        serverData.balance.total_mojo = totalMojos.toString()
      }

      // Синхронизация активных деривационных индексов кошелька
      if (serverData?.meta?.active_indexes) {
        const freshIndexesStr = serverData.meta.active_indexes.join(",")
        if (freshIndexesStr !== activeIndexes && typeof setActiveIndexes === "function") {
          setTimeout(() => setActiveIndexes(freshIndexesStr), 0)
        }
      }

      return serverData
    },
    enabled: !isVerifying && !isScreenLocked && !!unhardenedPkHex,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 1000, // Плановый поллинг каждые 10 секунд по архитектурному ТЗ
    refetchIntervalInBackground: false,
  })

  // Прямой проброс реактивных данных из кэша TanStack Query
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
    unspentCoins, // UI и UtxoCard видят склеенный массив с флагами isSpent и isLocked
    balance: query.data?.balance ?? null, 
    error: query.error,
    isFetching: query.isFetching,
    isLoading: query.isLoading || !query.data,
    refetch: query.refetch,
  }
}
