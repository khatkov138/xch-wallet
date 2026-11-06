'use client'

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { calculateChiaCoinId, signChiaTransaction } from "@/lib/utils/crypto"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"
import { useWalletSessionStore } from "@/store/useWalletSessessionStore"
import { useSendModalContext } from "../SendModalContext"

export function useSendTxMutation(sentTransactionsRef: React.MutableRefObject<Set<string>>) {
  const queryClient = useQueryClient()
  const { getMnemonicForSigning } = useWalletAuth()
  const network = useUserSettingsStore((state) => state.network)
  const ctx = useSendModalContext()

  return useMutation({
    mutationKey: ["send-transaction"],
    mutationFn: async () => {
      const { preparedSpendData, pin, localSnapshot } = ctx
      if (!preparedSpendData?.coin_spends || !pin || !localSnapshot) {
        throw new Error("Отсутствуют критические данные для отправки спендов")
      }
      
      const coinSpendsList = preparedSpendData.coin_spends

      for (const item of coinSpendsList) {
        const calculatedId = calculateChiaCoinId(
          item.coin.parent_coin_info, 
          item.coin.puzzle_hash, 
          item.coin.amount
        ).toLowerCase()
        
        const messageId = item.message_to_sign_hex.substring(64, 128).toLowerCase()
        if (messageId !== calculatedId) throw new Error("Критическая ошибка: Несоответствие Coin ID!")
      }

      if (preparedSpendData.verified_target_address !== localSnapshot.targetAddress) {
        throw new Error("Атака подмены: Целевой адрес изменен!")
      }

      const flatMessagesList = coinSpendsList.map((cs: any) => cs.message_to_sign_hex)
      const transactionFingerprint = flatMessagesList.join("|")
      
      if (sentTransactionsRef.current.has(transactionFingerprint)) {
        throw new Error("Транзакция уже находится в процессе отправки")
      }
      sentTransactionsRef.current.add(transactionFingerprint)

      const releaseIdempotencyLock = () => sentTransactionsRef.current.delete(transactionFingerprint)

      try {
        ctx.setStatusMessage("🔐 Подписание транзакции...")
        const clearMnemonic = await getMnemonicForSigning(pin)
        
        const signatures = await Promise.all(
          coinSpendsList.map((item: any) =>
            signChiaTransaction({ 
              mnemonic: clearMnemonic, 
              walletIndex: Number(item.wallet_index), 
              messageHex: item.message_to_sign_hex, 
              syntheticOffsetHex: item.synthetic_offset_hex 
            })
          )
        )

        ctx.setStatusMessage("🚀 Отправка в сеть...")
        const res = await fetch("/api/v1/transactions/send-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            network,
            signatures_list: signatures,
            coin_spends: coinSpendsList.map((cs: any) => ({ 
              wallet_index: cs.wallet_index, 
              synthetic_offset_hex: cs.synthetic_offset_hex, 
              coin: cs.coin, 
              puzzle_reveal: cs.puzzle_reveal, 
              solution: cs.solution 
            })),
            integrity_token: preparedSpendData.integrity_token,
            messages_signed_hex: flatMessagesList
          })
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || errData.error || `Сбой сетевого узла: Статус ${res.status}`)
        }

        const result = await res.json()
        if (!result.success) throw new Error(result.error || "Транзакция отклонена мемпулом ноды")

        return result
      } catch (error) {
        releaseIdempotencyLock()
        throw error
      }
    },
    onSuccess: (resData) => {
      ctx.setTxResponseData(resData)
      ctx.setPin("")
      ctx.setStep(3) 

      // 1. Собираем Сет ID сожженных монет-инпутов
      const spentCoinIds = new Set<string>(
        (resData?.tracked_info?.spent_coins || []).map((c: any) => String(c.coin_id).toLowerCase())
      )

      // 2. Сбор чистой сдачи по нативному флагу бэкенда (без гадания на индексах)
      const serverCreatedCoins: any[] = resData?.tracked_info?.created_coins || []
      const optimisticChangeCoins = serverCreatedCoins.filter((coin: any) => coin.is_change === true)

      // 3. Доступ к каноническому ключу кэша дашборда
      const activePk = useWalletSessionStore.getState().unhardenedPkHex
      const activeIndexes = useWalletSessionStore.getState().activeIndexes
      const targetQueryKey = ["wallet-dashboard", network, activePk, activeIndexes]

      // 4. 🚀 МГНОВЕННАЯ МУТАЦИЯ КЭША TANSTACK QUERY БЕЗ ИНВАЛИДАЦИИ
      queryClient.setQueryData(targetQueryKey, (oldData: any) => {
        if (!oldData || !oldData.unspent_coins) return oldData

        // А. Проставляем флаг траты инпута (оставляем в массиве!)
        const mutatedServerCoins = oldData.unspent_coins.map((item: any) => {
          const cId = String(item?.coin_id ?? "").toLowerCase()
          if (spentCoinIds.has(cId)) {
            return {
              ...item,
              isSpent: true // 🌟 Монета потрачена, но её баланс пока СЧИТАЕМ
            }
          }
          return item
        })

        // Б. Строим карту для UI-индексов адресов (puzzle_hash -> index)
        const phToIdxMap = new Map<string, number>()
        ;(oldData?.balance?.addresses || []).forEach((addr: any) => {
          const cleanPh = String(addr?.puzzle_hash ?? "").trim().toLowerCase()
          if (cleanPh) phToIdxMap.set(cleanPh, Number(addr.index))
        })

        // В. Упаковываем новые монеты сдачи с флагом isLocked
        const normalizedChangeCoins = optimisticChangeCoins.map((item: any) => {
          const coinPh = String(item?.puzzle_hash ?? "").trim().toLowerCase()
          const matchedIndex = phToIdxMap.has(coinPh) ? phToIdxMap.get(coinPh) : 0

          return {
            coin_id: item.coin_id,
            wallet_index: matchedIndex,
            isLocked: true, // 🌟 Сдача создана, тратить нельзя, её баланс ИГНОРИРУЕМ до блока
            coin: {
              parent_coin_info: item.parent_coin_info,
              puzzle_hash: item.puzzle_hash,
              amount: item.amount
            }
          }
        })

        const finalUnspentCoins = [...mutatedServerCoins, ...normalizedChangeCoins]

        // Г. 🧮 УМНЫЙ UTXO ПОДБОР БАЛАНСА ПО МОДЕЛИ SEND-AMOUNT-INCLUDES-FEES
        const totalMojos = finalUnspentCoins.reduce((acc: bigint, item: any) => {
          // Если это мемпул-сдача (isLocked) — её баланс НЕ плюсуем, чтобы цифры не двоились
          if (item?.isLocked === true) return acc
          
          // Если монета потрачена (isSpent) — она ВСЁ ЕЩЕ плюсуется, пока блок не собран
          const rawAmount = item?.coin?.amount
          return rawAmount !== undefined && rawAmount !== null ? acc + BigInt(rawAmount) : acc
        }, BigInt(0))

        const newXchStr = (Number(totalMojos) / 1_000_000_000_000).toFixed(4)

        return {
          ...oldData,
          balance: {
            ...oldData.balance,
            total_xch: newXchStr,
            total_mojo: totalMojos.toString()
          },
          unspent_coins: finalUnspentCoins
        }
      })
    },
    onError: (err: any) => {
      ctx.setStatusMessage(`❌ ${err.message}`)
      const flatMessagesList = ctx.preparedSpendData?.coin_spends?.map((cs: any) => cs.message_to_sign_hex) || []
      if (flatMessagesList.length > 0) {
        sentTransactionsRef.current.delete(flatMessagesList.join("|"))
      }
    }
  })
}
