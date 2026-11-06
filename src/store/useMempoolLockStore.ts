import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OptimisticCoin {
  coin_id: string
  wallet_index: number
  network: string
  coin: {
    parent_coin_info: string
    puzzle_hash: string
    amount: number | string
  }
  isLocked: boolean
}

interface MempoolLockState {
  isHydrated: boolean
  spentCoinIds: Record<string, { network: string }>
  optimisticCoins: Record<string, OptimisticCoin>
  lockTransactionData: (network: string, spentIds: string[], newCoins: any[]) => void
  syncWithServerCoins: (network: string, serverUnspentIds: Set<string>) => void
  clearNetworkLocks: (network: string) => void
}

export const useMempoolLockStore = create<MempoolLockState>()(
  persist(
    (set) => ({
      isHydrated: false,
      spentCoinIds: {},
      optimisticCoins: {},
      
      lockTransactionData: (network, spentIds, newCoins) => set((state) => {
        const newSpent = { ...state.spentCoinIds }
        const newOptimistic = { ...state.optimisticCoins }

        // Сохраняем как есть (все строки уже с 0x в нижнем регистре)
        spentIds.forEach(id => {
          if (id) newSpent[id.toLowerCase()] = { network }
        })

        newCoins.forEach(c => {
          if (!c.coin_id) return
          const cleanId = String(c.coin_id).toLowerCase()
          
          newOptimistic[cleanId] = {
            coin_id: c.coin_id,
            wallet_index: c.wallet_index ?? 0,
            network,
            coin: {
              parent_coin_info: c.parent_coin_info,
              puzzle_hash: c.puzzle_hash,
              amount: c.amount
            },
            isLocked: true
          }
        })

        return { spentCoinIds: newSpent, optimisticCoins: newOptimistic }
      }),

      syncWithServerCoins: (network, serverUnspentIds) => set((state) => {
        const newSpent = { ...state.spentCoinIds }
        const newOptimistic = { ...state.optimisticCoins }
        let hasChanges = false

        // 1. Убираем потраченную монету, если её больше нет в ответе сервера
        Object.keys(newSpent).forEach(id => {
          if (newSpent[id].network !== network) return
          if (!serverUnspentIds.has(id)) {
            delete newSpent[id]
            hasChanges = true
          }
        })

        // 2. Убираем монету сдачи из Zustand, как только она легально появилась на сервере
        Object.keys(newOptimistic).forEach(id => {
          const coin = newOptimistic[id]
          if (coin.network !== network) return
          if (serverUnspentIds.has(id)) {
            delete newOptimistic[id]
            hasChanges = true
          }
        })

        return hasChanges ? { spentCoinIds: newSpent, optimisticCoins: newOptimistic } : {}
      }),

      clearNetworkLocks: (network) => set((state) => {
        const newSpent = { ...state.spentCoinIds }
        const newOptimistic = { ...state.optimisticCoins }

        Object.keys(newSpent).forEach(id => {
          if (newSpent[id].network === network) delete newSpent[id]
        })
        Object.keys(newOptimistic).forEach(id => {
          if (newOptimistic[id].network === network) delete newOptimistic[id]
        })

        return { spentCoinIds: newSpent, optimisticCoins: newOptimistic }
      })
    }),
    {
      name: 'xchia-mempool-utxo-pure-sync-store',
      partialize: (state) => ({
        spentCoinIds: state.spentCoinIds,
        optimisticCoins: state.optimisticCoins,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) state.isHydrated = true
        }
      }
    }
  )
)
