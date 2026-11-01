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
  unspentCoins: any[]      // Массив легких монет
  walletAddresses: any[]   // 🎯 ПРИНЯЛИ: Новый массив адресов с address_pubkey_hex
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
  unspentCoins,
  walletAddresses
}: UseSendTransactionProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [pinAttempts, setPinAttempts] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [preparedSpendData, setPreparedSpendData] = useState<any>(null)
  const [localSnapshot, setLocalSnapshot] = useState<LocalSnapshot | null>(null)

  const { getMnemonicForSigning } = useWalletAuth()

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
      if (!targetAddress || !amount) throw new Error("Заполните адрес и сумму")

      const xch = parseFloat(amount.trim().replace(",", "."))
      if (isNaN(xch) || xch <= 0) throw new Error("Введите корректную сумму")

      const totalMojosToSend = Math.round(xch * 1_000_000_000_000)
      const totalFeeMojos = parseInt(customFeeMojo.trim() || "0", 10)
      const required = totalMojosToSend + totalFeeMojos

      let selectedItems = []
      let accumulatedAmount = 0

      // 🎯 В ТУПУЮ СХОДУ: Сортируем абсолютно ВСЕ монеты от больших к мелким (b - a)
      const sortedCoins = [...unspentCoins]
        .sort((a: any, b: any) => b.coin.amount - a.coin.amount)

      // Складываем монеты в массив, пока не наберется нужная сумма
      for (const item of sortedCoins) {
        selectedItems.push(item)
        accumulatedAmount += item.coin.amount
        if (accumulatedAmount >= required) {
          break // Набрали сумму — выходим
        }
      }

      // Если после прохода по всем монетам сумма не набралась — выкидываем ошибку
      if (accumulatedAmount < required) {
        throw new Error(`Недостаточно монет на всех адресах кошелька! Набрано: ${accumulatedAmount} / Требуется: ${required} mojo`)
      }

      // 2. ФОРМИРОВАНИЕ МАССИВА INPUTS ДЛЯ БЭКЕНДА
      const inputs = selectedItems.map((item: any) => {
        // Находим публичный ключ для каждой конкретной монеты по её puzzle_hash
        const matchedAddressData = walletAddresses.find(
          (addr: any) => addr.puzzle_hash.toLowerCase() === item.coin.puzzle_hash.toLowerCase()
        )
        const coinPkHex = matchedAddressData?.address_pubkey_hex

        if (!coinPkHex) {
          throw new Error(`Критическая ошибка: Публичный ключ для монеты ${item.coin.puzzle_hash.slice(0, 10)}... не найден!`)
        }

        return {
          coin_pk_hex: coinPkHex,
          coin_to_spend: item.coin,
          wallet_index: item.wallet_index // 🎯 Прокидываем оригинальный индекс деривации конкретной монеты наружу
        }
      })

      // Запоминаем локальный снапшот (берем walletIndex первой ведущей монеты)
      const snapshot: LocalSnapshot & { walletIndex: number } = {
        targetAddress: targetAddress.trim(),
        mojosToSend: totalMojosToSend,
        feeMojos: totalFeeMojos,
        walletIndex: selectedItems[0].wallet_index
      }
      setLocalSnapshot(snapshot)

      // 3. ОТПРАВКА НА БЭКЕНД
      const res = await fetch("api/v1/transactions/build-spend-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: inputs, // Отправляем сформированный массив монет
          send_to_address: snapshot.targetAddress,
          mojos_to_send: snapshot.mojosToSend,
          fee_mojos: snapshot.feeMojos
        })
      })

      const result = await res.json()
      console.log("📥 [КОНСОЛЬ-ЛОГ] Ответ бэка на Шаге 1:", result)
      if (!res.ok || !result.success) throw new Error(result.detail || "Не удалось подготовить транзакцию")

      // 🎯 МАГИЯ: Возвращаем массив индексов для каждого сообщения, чтобы Шаг 2 знал, чем подписывать!
      return {
        ...result,
        target_wallet_indexes: inputs.map(i => i.wallet_index)
      }
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
const sendTxMutation = useMutation({
    mutationFn: async () => {
      // КРИТИЧЕСКИЙ ЧЕК: Проверяем наличие массива индексов деривации монет
      if (!preparedSpendData?.target_wallet_indexes || !pin || !localSnapshot) {
        throw new Error("Критическая ошибка: отсутствуют индексы деривации или локальный снапшот!")
      }
      if (pin.length !== 6) throw new Error("ПИН-код должен состоять из 6 цифр")

      console.log("\n========================================================")
      console.log("🔍 [ШАГ 2] ЗАПУЩЕН МУЛЬТИ-ВХОДНОЙ КРИПТО-АУДИТ...")
      console.log("========================================================")

      // Достаем массивы из ответа Шага 1
      const coinSpendsList = preparedSpendData.coin_spends
      const messagesList = preparedSpendData.messages_to_sign_hex
      const walletIndexesList = preparedSpendData.target_wallet_indexes

      if (!coinSpendsList || !messagesList || coinSpendsList.length !== messagesList.length) {
        throw new Error("Критическая ошибка: Несоответствие структуры данных спендов и сообщений подписи!")
      }

      // 1. Циклический математический аудит КАЖДОЙ монеты
      for (let i = 0; i < coinSpendsList.length; i++) {
        const coinSource = coinSpendsList[i].coin
        const parentHex = coinSource.parent_coin_info
        const puzzleHashHex = coinSource.puzzle_hash
        const amountMojo = coinSource.amount

        const trueCoinId = calculateChiaCoinId(parentHex, puzzleHashHex, amountMojo)
        const fullMessageHex = messagesList[i].toLowerCase().trim()
        const coinIdFromMessage = fullMessageHex.substring(64, 128)

        console.log(`📡 [Аудит монеты #${i}]`)
        console.log(`   - Ожидаемый Coin ID: ${trueCoinId}`)
        console.log(`   - Извлеченный из сообщения Coin ID: ${coinIdFromMessage}`)

        if (coinIdFromMessage !== trueCoinId) {
          console.error(`❌ КРИТИЧЕСКАЯ АТАКА! Coin ID не совпали на монете #${i}!`)
          throw new Error(`Критическая атака! Бэкенд подменил монету-источник #${i} внутри хэша подписи!`)
        }
      }
      console.log("💪 Математический аудит всех инпутов пройден успешно!")

      // 🛡️ 2. АУДИТ ЧЕРЕЗ СНАПШОТ: Сверяем данные с локальным стейтом
      console.log("\n📸 Проверяем соответствие данных с локальным снапшотом...")
      if (preparedSpendData.verified_target_address !== localSnapshot.targetAddress) {
        console.error("❌ ПОДМЕНА АДРЕСА: Бэк вернул левый адрес!", preparedSpendData.verified_target_address)
        throw new Error("Критическая ошибка: Конечный адрес получателя изменен бэкендом или перехвачен!")
      }

      if (preparedSpendData.verified_mojos_to_send !== localSnapshot.mojosToSend) {
        console.error("❌ ПОДМЕНА СУММЫ: Бэк изменил сумму!", preparedSpendData.verified_mojos_to_send)
        throw new Error("Критическая ошибка: Конечная сумма транзакции изменена бэкендом или перехвачен!")
      }
      console.log("💪 Снапшот-аудит пройден успешно! Данные чисты.")

      // 3. ДЕТАЛЬНОЕ ПОДПИСАНИЕ ВСЕХ СООБЩЕНИЙ С ЛОГАМИ РАЗРЯДНОСТИ
      setStatusMessage("🔐 Подписание транзакции...")
      const clearMnemonic = await getMnemonicForSigning(pin)

      console.log("\n🔑 [КРИПТОГРАФИЯ: ПОДПИСАНИЕ ИНПУТОВ]")
      const signatures = messagesList.map((msgHex: any, idx: number) => {
        const currentWalletIndex = walletIndexesList[idx]
        
        console.log(`  [Монета #${idx}] -> Деривация по индексу: ${currentWalletIndex}`)
        console.log(`    - Хэш для подписи (msgHex): ${msgHex}`)


        
        // Вызываем твою оригинальную функцию подписи
        const sig = signChiaTransaction({
          mnemonic: clearMnemonic,
          walletIndex: currentWalletIndex, // Передаем точный динамический индекс монеты (0, 169, 170...)
          messageHex: msgHex,
          hiddenPuzzleHashHex: preparedSpendData.hidden_puzzle_hash_hex
        })

        console.log(`    - Сгенерированная сигнатура (длина: ${sig.length} симв.): 0x${sig.slice(0, 20)}...`)
        
        if (sig.length !== 192) {
          console.error(`❌ Ошибка разрядности! Длина подписи ${sig.length} вместо 192.`);
        }

        return sig
      })
      console.log("========================================================\n")
      
      setStatusMessage("🚀 Отправка пакета трат в сеть...")

      // Формируем чистый массив коин-спендов для отправки на бэк
      const cleanCoinSpends = coinSpendsList.map((cs: any) => ({
        coin: {
          parent_coin_info: cs.coin.parent_coin_info,
          puzzle_hash: cs.coin.puzzle_hash,
          amount: cs.coin.amount
        },
        puzzle_reveal: cs.puzzle_reveal,
        solution: cs.solution
      }))

   
      // Пушим агрегированный массив на бэкенд
      const res = await fetch("/api/v1/transactions/send-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatures_list: signatures,
          coin_spends: cleanCoinSpends,
          integrity_token: preparedSpendData.integrity_token,
          messages_signed_hex: messagesList
        })
      })

      const result = await res.json()
      console.log("📥 [КОНСОЛЬ-ЛОГ] Финальный ответ бэка на Шаге 2:", result)
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
      console.error("❌ Ошибка на Шаге 2 во фронтенде:", err)
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
