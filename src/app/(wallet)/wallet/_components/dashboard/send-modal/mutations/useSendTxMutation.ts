import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { calculateChiaCoinId, signChiaTransaction } from "@/lib/utils/crypto"

export function useSendTxMutation(ctx: any, sentTransactionsRef: React.MutableRefObject<Set<string>>) {
  const queryClient = useQueryClient()
  const { getMnemonicForSigning } = useWalletAuth()

  return useMutation({
    mutationFn: async () => {
      const { preparedSpendData, pin, localSnapshot } = ctx
      if (!preparedSpendData?.coin_spends || !pin || !localSnapshot) throw new Error("Отсутствуют данные спендов или ПИН")
      if (pin.length !== 6) throw new Error("ПИН-код должен состоять из 6 цифр")

      const coinSpendsList = preparedSpendData.coin_spends
      
      // 1. Крипто-аудит Coin ID c приведением к нижнему регистру
      for (const item of coinSpendsList) {
        const trueCoinId = calculateChiaCoinId(item.coin.parent_coin_info, item.coin.puzzle_hash, item.coin.amount)
        if (item.message_to_sign_hex.substring(64, 128).toLowerCase() !== trueCoinId.toLowerCase()) {
          throw new Error("Несоответствие Coin ID!")
        }
      }

      // 2. Аудит лимитов и адреса
      if (preparedSpendData.verified_target_address !== localSnapshot.targetAddress) throw new Error("Подмена адреса!")
      if ((preparedSpendData.verified_mojos_to_send + (preparedSpendData.audit_info?.summary.fee_network_mojo || 0)) < localSnapshot.mojosToSend * 0.7) {
        throw new Error("Критическое проскальзывание комиссий (>30%)")
      }

      // 3. Подписание
      ctx.setStatusMessage("🔐 Подписание транзакции...")
      const clearMnemonic = await getMnemonicForSigning(pin)
      const signatures = await Promise.all(coinSpendsList.map((item: any) => 
        signChiaTransaction({ mnemonic: clearMnemonic, walletIndex: Number(item.wallet_index), messageHex: item.message_to_sign_hex, syntheticOffsetHex: item.synthetic_offset_hex })
      ))

      const flatMessagesList = coinSpendsList.map((cs: any) => cs.message_to_sign_hex)
      const transactionFingerprint = flatMessagesList.join("|")
      if (sentTransactionsRef.current.has(transactionFingerprint)) throw new Error("Транзакция уже отправляется")
      sentTransactionsRef.current.add(transactionFingerprint)

      ctx.setStatusMessage("🚀 Отправка в сеть...")
      const res = await fetch("/api/v1/transactions/send-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatures_list: signatures,
          coin_spends: coinSpendsList.map((cs: any) => ({ wallet_index: cs.wallet_index, synthetic_offset_hex: cs.synthetic_offset_hex, coin: cs.coin, puzzle_reveal: cs.puzzle_reveal, solution: cs.solution })),
          integrity_token: preparedSpendData.integrity_token,
          messages_signed_hex: flatMessagesList
        })
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        sentTransactionsRef.current.delete(transactionFingerprint)
        throw new Error(result.error || "Нода отклонила транзакцию")
      }
      return result
    },
    onSuccess: (resData) => {
      ctx.setStatusMessage("🎉 Успешно! Монеты отправлены!")
      ctx.setPin("")
      
      // 🎯 ПРОБРОС: Передаем сырой JSON-ответ в контекст для трекера Шага 3
      if (typeof ctx.setTxResponseData === "function") {
        ctx.setTxResponseData(resData)
      }

      // Пессимистичный сброс UTXO в основном дашборде
      const activePk = useWalletSession.getState().unhardenedPkHex
      queryClient.setQueryData(["wallet-dashboard", activePk], (oldData: any) => {
        if (!oldData || !resData.tracked_info) return oldData
        const spentSet = new Set(resData.tracked_info.spent_coins.map((id: string) => id.toLowerCase()))
        return { ...oldData, unspent_coins: oldData.unspent_coins.filter((utxo: any) => !spentSet.has((utxo.coin.coin_id || utxo.coin.parent_coin_info).toLowerCase())) }
      })
    },
    onError: (err: any) => {
      ctx.setStatusMessage(`❌ Ошибка: ${err.message}`)
      if (ctx.preparedSpendData?.coin_spends) {
        sentTransactionsRef.current.delete(ctx.preparedSpendData.coin_spends.map((cs: any) => cs.message_to_sign_hex).join("|"))
      }
    }
  })
}
