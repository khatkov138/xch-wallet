import { useState } from "react"
import { useWalletSession } from "@/store/useWalletStore"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { signChiaTransaction } from "@/utils/crypto"

interface UseSendTransactionProps {
  targetAddress: string
  amount: string
  customFeeMojo: string
  pin: string
  setPin: (pin: string) => void
  onClose: () => void
}

export function useSendTransaction({
  targetAddress,
  amount,
  customFeeMojo,
  pin,
  setPin,
  onClose
}: UseSendTransactionProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [pinAttempts, setPinAttempts] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [preparedSpendData, setPreparedSpendData] = useState<any>(null)

  const { getMnemonicForSigning } = useWalletAuth()
  const masterPkHex = useWalletSession((state) => state.unhardenedPkHex)

  const resetHooksState = () => {
    setPin("")
    setStep(1)
    setStatusMessage("")
    setPreparedSpendData(null)
    setPinAttempts(0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    // --- ШАГ 1: Поиск монет и сборка бандла на бэкенде ---
    if (step === 1) {
      if (!targetAddress || !amount) return
      setLoading(true); setStatusMessage("")
      try {
        if (!masterPkHex) throw new Error("Сессия не найдена")
        const xch = parseFloat(amount.trim().replace(",", "."))
        if (isNaN(xch) || xch <= 0) throw new Error("Введите корректную сумму")
        
        // 🔥 ПЕРЕВОДИМ В MOJO СРАЗУ НА ФРОНТЕНДЕ (Целое число)
        const totalMojosToSend = Math.round(xch * 1_000_000_000_000)

        const res = await fetch("http://localhost:8000/api/v1/transactions/build-spend-bundle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            master_pk_hex: masterPkHex,
            send_to_address: targetAddress.trim(),
            mojos_to_send: totalMojosToSend, // Шлем готовые моджи
            fee_mojos: parseInt(customFeeMojo.trim() || "0", 10)
          })
        })

        const result = await res.json()
        if (!res.ok || !result.success) throw new Error(result.detail || "Не удалось подготовить трату")

        setPreparedSpendData(result)
        setStep(2)
        setStatusMessage("")
      } catch (err: any) {
        setStatusMessage(`❌ Ошибка: ${err.message || err}`)
      } finally {
        setLoading(false)
      }

    // --- ШАГ 2: Валидация, деривация, локальная подпись и пуш в блокчейн ---
    } else {
      if ((preparedSpendData?.target_wallet_index ?? null) === null || !pin) return
      if (pin.length !== 6) return setStatusMessage("❌ ПИН-код должен состоять из 6 цифр")

      setLoading(true); setStatusMessage("")
      try {
        // 🛡️ [КРИПТО-АУДИТ]: ЖЕСТКАЯ СВЕРКА В MOJO БЕЗ ДРОБЕЙ JS
        if (preparedSpendData.verified_target_address !== targetAddress.trim()) {
          throw new Error("Критическая ошибка: Адрес получателя изменен бэкендом!")
        }

        // Пересчитываем моджи из инпута и сверяем два чистых целых числа
        const currentInputMojos = Math.round(parseFloat(amount.trim().replace(",", ".")) * 1_000_000_000_000)
        if (preparedSpendData.verified_mojos_to_send !== currentInputMojos) {
          throw new Error("Критическая ошибка: Сумма транзакции изменена бэкендом!")
        }

        const coinIdFromMessage = preparedSpendData.message_to_sign_hex.substring(64, 128)
        if (coinIdFromMessage !== preparedSpendData.verified_coin_id_hex) {
          throw new Error("Критическая ошибка: Бэкенд подменил монету-источник в подписи!")
        }

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
          coin: {
            parent_coin_info: preparedSpendData.coin_spend.coin.parent_coin_info,
            puzzle_hash: preparedSpendData.coin_spend.coin.puzzle_hash,
            amount: preparedSpendData.coin_spend.coin.amount
          },
          puzzle_reveal: preparedSpendData.coin_spend.puzzle_reveal,
          solution: preparedSpendData.coin_spend.solution
        }

        const res = await fetch("http://localhost:8000/api/v1/transactions/send-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature_hex: signatureHex,
            coin_spend: cleanCoinSpend
          })
        })

        const result = await res.json()
        if (!res.ok || !result.success) throw new Error(result.detail || "Нода отклонила транзакцию")

        setStatusMessage("🎉 Успешно! Монеты отправлены!")
        setPin(""); setPinAttempts(0)
      } catch (err: any) {
        const nextAttempts = pinAttempts + 1
        setPinAttempts(nextAttempts); setPin("")
        if (nextAttempts >= 3) {
          onClose()
        } else {
          setStatusMessage(`❌ Ошибка подписи! Осталось попыток: ${3 - nextAttempts}\n${err.message || err}`)
        }
      } finally {
        setLoading(false)
      }
    }
  }

  return {
    step,
    setStep,
    loading,
    statusMessage,
    preparedSpendData,
    handleSubmit,
    resetHooksState
  }
}
