import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { calculateChiaCoinId, signChiaTransaction } from "@/lib/utils/crypto"
import { useWalletSessionStore } from "@/store/useWalletSessessionStore"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"
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
      if (!preparedSpendData?.coin_spends || !pin || !localSnapshot) throw new Error("Отсутствуют данные спендов")
      
      const coinSpendsList = preparedSpendData.coin_spends

      // 1. Крипто-аудит Coin ID
      for (const item of coinSpendsList) {
        const trueCoinId = calculateChiaCoinId(item.coin.parent_coin_info, item.coin.puzzle_hash, item.coin.amount)
        if (item.message_to_sign_hex.substring(64, 128).toLowerCase() !== trueCoinId.toLowerCase()) {
          throw new Error("Несоответствие Coin ID!")
        }
      }

      // 2. Аудит лимитов
      if (preparedSpendData.verified_target_address !== localSnapshot.targetAddress) throw new Error("Подмена адреса!")

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

      let res: Response;
      try {
        res = await fetch("/api/v1/transactions/send-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            network,
            signatures_list: signatures,
            coin_spends: coinSpendsList.map((cs: any) => ({ wallet_index: cs.wallet_index, synthetic_offset_hex: cs.synthetic_offset_hex, coin: cs.coin, puzzle_reveal: cs.puzzle_reveal, solution: cs.solution })),
            integrity_token: preparedSpendData.integrity_token,
            messages_signed_hex: flatMessagesList
          })
        })
      } catch (networkErr: any) {
        sentTransactionsRef.current.delete(transactionFingerprint)
        throw new Error(`Ошибка сети: ${networkErr.message}`)
      }

      let result: any;
      try {
        result = await res.json()
      } catch (jsonErr) {
        sentTransactionsRef.current.delete(transactionFingerprint)
        throw new Error("Критический сбой API: Некорректный ответ сервера")
      }

      if (!res.ok || !result.success) {
        sentTransactionsRef.current.delete(transactionFingerprint)
        if (result.detail) throw new Error(typeof result.detail === "string" ? result.detail : JSON.stringify(result.detail))
        if (result.error) throw new Error(result.error)
        throw new Error("Транзакция отклонена нодой")
      }

      return result
    },
    onSuccess: (resData) => {
      ctx.setTxResponseData(resData)
      ctx.setPin("")
      ctx.setStep(3) // 🚀 Сама мутация жестко переключает экран на Шаг 3

      // Обновление кэша UTXO
      const activePk = useWalletSessionStore.getState().unhardenedPkHex
      const activeIndexes = useWalletSessionStore.getState().activeIndexes
      const targetKey = ["wallet-dashboard", network, activePk, activeIndexes]

      const backendSpentCoins = resData?.tracked_info?.spent_coins || []

      queryClient.setQueryData(targetKey, (oldData: any) => {
        if (!oldData || !oldData.unspent_coins) return oldData
        return {
          ...oldData,
          unspent_coins: oldData.unspent_coins.filter((utxo: any) => {
            const uParent = (utxo?.coin?.parent_coin_info || "").trim().toLowerCase()
            const uPuzzle = (utxo?.coin?.puzzle_hash || "").trim().toLowerCase()
            const uAmount = Number(utxo?.coin?.amount || 0)

            return !backendSpentCoins.some((spent: any) => {
              const sParent = (spent?.parent_coin_info || "").trim().toLowerCase()
              const sPuzzle = (spent?.puzzle_hash || "").trim().toLowerCase()
              const sAmount = Number(spent?.amount || 0)
              return uParent === sParent && uPuzzle === sPuzzle && uAmount === sAmount
            })
          })
        }
      })
    },
    onError: (err: any) => {
      ctx.setStatusMessage(`❌ ${err.message}`)
      if (ctx.preparedSpendData?.coin_spends) {
        const flatMessagesList = ctx.preparedSpendData.coin_spends.map((cs: any) => cs.message_to_sign_hex)
        if (flatMessagesList.length > 0) {
          sentTransactionsRef.current.delete(flatMessagesList.join("|"))
        }
      }
    }
  })
}
