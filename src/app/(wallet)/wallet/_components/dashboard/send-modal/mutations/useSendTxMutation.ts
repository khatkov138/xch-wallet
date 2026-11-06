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
        const calculatedId = calculateChiaCoinId(item.coin.parent_coin_info, item.coin.puzzle_hash, item.coin.amount).toLowerCase()
        if (item.message_to_sign_hex.substring(64, 128).toLowerCase() !== calculatedId) throw new Error("Критическая ошибка: Несоответствие Coin ID!")
      }
      if (preparedSpendData.verified_target_address !== localSnapshot.targetAddress) throw new Error("Атака подмены: Целевой адрес изменен!")
      const flatMessagesList = coinSpendsList.map((cs: any) => cs.message_to_sign_hex)
      const transactionFingerprint = flatMessagesList.join("|")
      if (sentTransactionsRef.current.has(transactionFingerprint)) throw new Error("Транзакция уже находится в процессе отправки")
      sentTransactionsRef.current.add(transactionFingerprint)
      const releaseIdempotencyLock = () => sentTransactionsRef.current.delete(transactionFingerprint)

      try {
        ctx.setStatusMessage("🔐 Подписание транзакции...")
        const clearMnemonic = await getMnemonicForSigning(pin)
        const signatures = await Promise.all(coinSpendsList.map((item: any) => signChiaTransaction({ mnemonic: clearMnemonic, walletIndex: Number(item.wallet_index), messageHex: item.message_to_sign_hex, syntheticOffsetHex: item.synthetic_offset_hex })))
        ctx.setStatusMessage("🚀 Отправка в сеть...")
        const res = await fetch("/api/v1/transactions/send-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ network, signatures_list: signatures, coin_spends: coinSpendsList.map((cs: any) => ({ wallet_index: cs.wallet_index, synthetic_offset_hex: cs.synthetic_offset_hex, coin: cs.coin, puzzle_reveal: cs.puzzle_reveal, solution: cs.solution })), integrity_token: preparedSpendData.integrity_token, messages_signed_hex: flatMessagesList })
        })
        if (!res.ok) throw new Error(`Сбой сетевого узла: Статус ${res.status}`)
        const result = await res.json()
        if (!result.success) throw new Error(result.error || "Транзакция отклонена мемпулом ноды")
        return result
      } catch (error) { releaseIdempotencyLock(); throw error }
    },
    onSuccess: (resData) => {
      ctx.setTxResponseData(resData)
      ctx.setPin("")
      ctx.setStep(3) 

      const txId = resData?.tx_id || "unknown_tx"
      const nowTimestamp = resData?.timestamp || Math.floor(Date.now() / 1000)
      const spentCoinIds = new Set<string>((resData?.tracked_info?.spent_coins || []).map((c: any) => String(c.coin_id ?? "").toLowerCase()))
      
      const serverCreatedCoins: any[] = resData?.tracked_info?.created_coins || []
      
      // 🌟 ДЛЯ МОНЕТ (ЛОГИКА ОСТАЕТСЯ КАК БЫЛО): Забираем только истинную сдачу
      const optimisticChangeCoins = serverCreatedCoins.filter((coin: any) => coin?.is_change === true)

      // 🎯 ДЛЯ ИСТOРИИ АКТИВНОСТИ (СИНХРОНИЗАЦИЯ С ШАГОМ 3): Берем индекс 0 — монету получателя!
      const recipientCoin = serverCreatedCoins.length > 0 ? serverCreatedCoins[0] : null
      const trueTargetCoinId = recipientCoin?.coin_id || txId
      const targetHexPuzzleHash = recipientCoin?.puzzle_hash || "0x0000000000000000000000000000000000000000000000000000000000000000"
      
      const firstInputCoin = resData?.tracked_info?.spent_coins?.[0]

      // Формируем исходящую запись для истории активности
      const outgoingTx = {
        tx_id: txId,
        parent_coin_info: firstInputCoin?.parent_coin_info || firstInputCoin?.coin_id || "0x",
        created_coin_id: trueTargetCoinId, // 🚀 ID монеты получателя (индекс 0) как на Шаге 3
        type: "outgoing",
        amount: String(ctx.amount || "0.0000"),
        puzzle_hash: targetHexPuzzleHash,
        timestamp: nowTimestamp,
        status: "pending"
      }

      const activePk = useWalletSessionStore.getState().unhardenedPkHex
      const activeIndexes = useWalletSessionStore.getState().activeIndexes
      const targetQueryKey = ["wallet-dashboard", network, activePk, activeIndexes]

      queryClient.setQueryData(targetQueryKey, (oldData: any) => {
        if (!oldData) return oldData
        
        // А. Навешиваем флаг траты инпута (оставляем в массиве!)
        const mutatedServerCoins = (oldData.unspent_coins || []).map((item: any) => 
          spentCoinIds.has(String(item?.coin_id ?? "").toLowerCase()) ? { ...item, isSpent: true } : item
        )
        
        // Б. Карта для UI-индексов адресов (puzzle_hash -> index)
        const phToIdxMap = new Map<string, number>()
        ;(oldData?.balance?.addresses || []).forEach((addr: any) => { 
          if (addr?.puzzle_hash) phToIdxMap.set(String(addr.puzzle_hash).trim().toLowerCase(), Number(addr.index)) 
        })
        
        // В. 🌟 ЛОГИКА ДОБАВЛЕНИЯ СДАЧИ ОСТАЕТСЯ КАК БЫЛО: Пушим только отфильтрованные монеты сдачи (is_change: true)
        const normalizedChangeCoins = optimisticChangeCoins.map((item: any) => {
          const coinPh = String(item?.puzzle_hash ?? "").trim().toLowerCase()
          return { 
            coin_id: item.coin_id, 
            wallet_index: phToIdxMap.has(coinPh) ? phToIdxMap.get(coinPh) : 0, 
            isLocked: true, 
            coin: { parent_coin_info: item.parent_coin_info, puzzle_hash: item.puzzle_hash, amount: item.amount } 
          }
        })
        
        const finalUnspentCoins = [...mutatedServerCoins, ...normalizedChangeCoins]
        
        // Г. Подсчет баланса по нашей правильной схеме: locked — считаем, spent — не считаем
        const totalMojos = finalUnspentCoins.reduce((acc: bigint, item: any) => 
          item?.isSpent === true ? acc : acc + BigInt(item?.coin?.amount ?? 0), BigInt(0)
        )

        return {
          ...oldData,
          balance: { ...oldData.balance, total_xch: (Number(totalMojos) / 1_000_000_000_000).toFixed(4), total_mojo: totalMojos.toString() },
          unspent_coins: finalUnspentCoins,
          transactions: [outgoingTx, ...(oldData.transactions || [])].slice(0, 50)
        }
      })
    }
  })
}
