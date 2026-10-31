import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { calculateChiaCoinId, signChiaTransaction } from "@/lib/utils/crypto"

interface UseSendTransactionProps {
  targetAddress: string
  amount: string  
  customFeeMojo: string
  pin: string
  setPin: (pin: string) => void
  onClose: () => void
  unspentCoins: any[] // 🎯 ПРИНЯЛИ: Сюда прокидываем массив монет из хука useWalletDashboard
}

interface LocalSnapshot {
  targetAddress: string
  mojosToSend: number
  feeMojos: number
}

export function useSendTransaction({
  targetAddress,
  amount,
  customFeeMojo,
  pin,
  setPin,
  onClose,
  unspentCoins // 🎯 ПРИНЯЛИ
}: UseSendTransactionProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [pinAttempts, setPinAttempts] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [preparedSpendData, setPreparedSpendData] = useState<any>(null)
  const [localSnapshot, setLocalSnapshot] = useState<LocalSnapshot | null>(null)

  const { getMnemonicForSigning } = useWalletAuth()
  const masterPkHex = useWalletSession((state) => state.unhardenedPkHex)

  const resetHooksState = () => {
    setPin("")
    setStep(1)
    setStatusMessage("")
    setPreparedSpendData(null)
    setPinAttempts(0)
    setLocalSnapshot(null)
    buildBundleMutation.reset()
    sendTxMutation.reset()
  }

  // --- МУТАЦИЯ ШАГА 1: Запрос на сборку транзакции ---
  const buildBundleMutation = useMutation({
    mutationFn: async () => {
      if (!masterPkHex) throw new Error("Сессия не найдена")
      if (!targetAddress || !amount) throw new Error("Заполните адрес и сумму")

      const xch = parseFloat(amount.trim().replace(",", "."))
      if (isNaN(xch) || xch <= 0) throw new Error("Введите корректную сумму")

      const totalMojosToSend = Math.round(xch * 1_000_000_000_000)
      const totalFeeMojos = parseInt(customFeeMojo.trim() || "0", 10)
      const required = totalMojosToSend + totalFeeMojos

      // 🎯 ВЫБОР КОИНА: Логика один-в-один как была на бэкенде по дефолту
      // Ищем среди непотраченных монет ту, что лежит на индексе 0 и имеет достаточный баланс
      
      const suitableItem = unspentCoins.find(
        (item: any) => item.wallet_index === 0 && item.coin.amount >= required
      )

      if (!suitableItem) {
        throw new Error("На основном адресе (индекс 0) недостаточно монет для покрытия суммы и комиссии!")
      }

      const snapshot: LocalSnapshot = {
        targetAddress: targetAddress.trim(),
        mojosToSend: totalMojosToSend,
        feeMojos: totalFeeMojos
      }
      setLocalSnapshot(snapshot)

      const res = await fetch("http://localhost:8000/api/v1/transactions/build-spend-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          master_pk_hex: masterPkHex,
          wallet_index: suitableItem.wallet_index, // 🎯 передаем индекс кошелька (0)
          coin_to_spend: suitableItem.coin,       // 🎯 передаем саму купюру
          send_to_address: snapshot.targetAddress,
          mojos_to_send: snapshot.mojosToSend,
          fee_mojos: snapshot.feeMojos
        })
      })

      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.detail || "Не удалось подготовить транзакцию")
      return result
    },
    onSuccess: (data) => {
      console.log("➡️ [ШАГ 1] Данные успешно получены с бэкенда:", data)
      setPreparedSpendData(data)
      setStep(2)
      setStatusMessage("")
    },
    onError: (err: any) => {
      setStatusMessage(`❌ Ошибка подготовки: ${err.message || err}`)
      setLocalSnapshot(null)
    }
  })

  // --- МУТАЦИЯ ШАГА 2: Математический аудит, подписание и пуш ---
  const sendTxMutation = useMutation({
    mutationFn: async () => {
      if ((preparedSpendData?.target_wallet_index ?? null) === null || !pin || !localSnapshot) return
      if (pin.length !== 6) throw new Error("ПИН-код должен состоять из 6 цифр")

      const coinSource = preparedSpendData.coin_spend.coin
      const parentHex = coinSource.parent_coin_info
      const puzzleHashHex = coinSource.puzzle_hash
      const amountMojo = coinSource.amount

      console.log("🔍 [ШАГ 2] Начинаем крипто-аудит монеты...")

      // 1. Математический аудит (Coin ID) — Проверка, что бэк не подсунул левый хэш сообщения
      const trueCoinId = calculateChiaCoinId(parentHex, puzzleHashHex, amountMojo)
      const fullMessageHex = preparedSpendData.message_to_sign_hex.toLowerCase().trim();
      const coinIdFromMessage = fullMessageHex.substring(64, 128);

      if (coinIdFromMessage !== trueCoinId) {
        console.error("❌ КРИТИЧЕСКАЯ АТАКА! Coin ID не совпадают!")
        throw new Error("Критическая атака! Бэкенд подменил монету-источник внутри хэша подписи!")
      }

      // 🛡️ 2. АУДИТ ЧЕРЕЗ СНАПШОТ: Полное отсечение доверия к данным бэка
      console.log("📸 Проверяем соответствие данных с локальным снапшотом...")

      // Сверяем адрес получателя
      if (preparedSpendData.verified_target_address !== localSnapshot.targetAddress) {
        console.error("❌ ПОДМЕНА АДРЕСА: Бэк вернул левый адрес!", preparedSpendData.verified_target_address)
        throw new Error("Критическая ошибка: Конечный адрес получателя изменен бэкендом или перехвачен!")
      }

      // Сверяем сумму в mojo
      if (preparedSpendData.verified_mojos_to_send !== localSnapshot.mojosToSend) {
        console.error("❌ ПОДМЕНА СУММЫ: Бэк изменил сумму!", preparedSpendData.verified_mojos_to_send)
        throw new Error("Критическая ошибка: Конечная сумма транзакции изменена бэкендом или перехвачен!")
      }

      console.log("💪 Снапшот-аудит пройден успешно! Данные чисты.")

      // --- Дальше идет твой стандартный неизмененный код подписания и fetch ---
      setStatusMessage("🔐 Подписание транзакции...")
      const clearMnemonic = await getMnemonicForSigning(pin)

      const signatureHex = signChiaTransaction({
        mnemonic: clearMnemonic,
        walletIndex: preparedSpendData.target_wallet_index,
        messageHex: preparedSpendData.message_to_sign_hex,
        hiddenPuzzleHashHex: preparedSpendData.hidden_puzzle_hash_hex
      })

      setStatusMessage("🚀 Отправка пакета трат в сеть...")

      const cleanCoinSpend = {
        coin: { parent_coin_info: parentHex, puzzle_hash: puzzleHashHex, amount: amountMojo },
        puzzle_reveal: preparedSpendData.coin_spend.puzzle_reveal,
        solution: preparedSpendData.coin_spend.solution
      }

      const res = await fetch("http://localhost:8000/api/v1/transactions/send-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_hex: signatureHex,
          coin_spend: cleanCoinSpend,
          integrity_token: preparedSpendData.integrity_token,
          message_signed_hex: preparedSpendData.message_to_sign_hex
        })
      })

      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.detail || "Нода отклонила транзакцию")
      return result
    },
    onSuccess: (resData) => {
      console.log("🎉 Транзакция успешно улетела в Chia RPC:", resData)
      setStatusMessage("🎉 Успешно! Монеты отправлены!")
      setPin("")
      setPinAttempts(0)
    },
    onError: (err: any) => {
      console.error("❌ Ошибка на Шаге 2:", err)
      const nextAttempts = pinAttempts + 1
      setPinAttempts(nextAttempts)
      setPin("")

      if (nextAttempts >= 3) {
        onClose()
      } else {
        setStatusMessage(`❌ Ошибка крипто-аудита или подписи! Осталось попыток: ${3 - nextAttempts}\n${err.message || err}`)
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (buildBundleMutation.isPending || sendTxMutation.isPending) return

    if (step === 1) {
      buildBundleMutation.mutate()
    } else {
      sendTxMutation.mutate()
    }
  }

  return {
    step,
    setStep,
    loading: buildBundleMutation.isPending || sendTxMutation.isPending,
    statusMessage,
    preparedSpendData,
    handleSubmit,
    resetHooksState
  }
}
