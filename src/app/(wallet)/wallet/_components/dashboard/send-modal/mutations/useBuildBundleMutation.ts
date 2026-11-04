import { useMutation } from "@tanstack/react-query"
import { selectChiaCoins } from "../ChiaCoinSelection"
import { useWalletSession } from "@/store/useWalletStore"




export function useBuildBundleMutation(ctx: any, unspentCoins: any[], walletAddresses: any[]) {

  const network = useWalletSession((state) => state.network);


  return useMutation({
    mutationFn: async () => {


      const { targetAddress, amount, customFeeMojo } = ctx
      if (!targetAddress || !amount) throw new Error("Заполните адрес и сумму")

      const xch = parseFloat(amount.trim().replace(",", "."))
      if (isNaN(xch) || xch <= 0) throw new Error("Введите корректную сумму")

      const totalMojosToSend = Math.round(xch * 1_000_000_000_000)
      const totalFeeMojos = parseInt(customFeeMojo.trim() || "0", 10)

      const selectedItems = selectChiaCoins(amount, unspentCoins)
      const accumulatedAmount = selectedItems.reduce((sum: number, item: any) => sum + item.coin.amount, 0)

      if (accumulatedAmount < totalMojosToSend) {
        throw new Error(`Недостаточно монет! Набрано: ${accumulatedAmount} / Требуется: ${totalMojosToSend} mojo`)
      }

      const inputs = selectedItems.map((item: any) => {
        const matched = walletAddresses.find((a: any) => a.puzzle_hash.toLowerCase() === item.coin.puzzle_hash.toLowerCase())
        if (!matched?.address_pubkey_hex) throw new Error("Публичный ключ не найден")
        return { coin_pk_hex: matched.address_pubkey_hex, coin_to_spend: item.coin, wallet_index: item.wallet_index }
      })

      const res = await fetch("/api/v1/transactions/build-spend-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          inputs,
          send_to_address: targetAddress.trim(),
          mojos_to_send: totalMojosToSend,
          fee_mojos: totalFeeMojos
        })
      })

      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.detail || "Ошибка подготовки")

      // Возвращаем данные для сохранения и локальный снапшот для Шага 2
      return { data: result, snapshot: { targetAddress: targetAddress.trim(), mojosToSend: totalMojosToSend } }
    },
    onSuccess: ({ data, snapshot }, _, __) => {
      ctx.setPreparedSpendData(data)
      ctx.setLocalSnapshot(snapshot)
      ctx.setStep(2)
      ctx.setStatusMessage("")
    },
    onError: (err: any, _, __) => {
      ctx.setStatusMessage(`❌ Ошибка подготовки: ${err.message}`)
      ctx.setLocalSnapshot(null)
    }
  })
}
