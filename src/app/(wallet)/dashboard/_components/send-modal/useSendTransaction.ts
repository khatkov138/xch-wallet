import { useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { calculateChiaCoinId, signChiaTransaction } from "@/lib/utils/crypto"
import { selectChiaCoins } from "./ChiaCoinSelection"

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
  const sentTransactionsRef = useRef<Set<string>>(new Set());
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

    // 🎯 ИСПОЛЬЗУЕМ ЕДИНЫЙ ХЕЛПЕР ДЛЯ ПОДБОРА МОНЕТ
    const selectedItems = selectChiaCoins(amount, unspentCoins)
    
    // Считаем общую сумму накопленных Mojo через чистый reduce
    const accumulatedAmount = selectedItems.reduce((sum: number, item: any) => sum + item.coin.amount, 0)

    // Проверка баланса строго по чистой сумме отправки
    if (accumulatedAmount < totalMojosToSend) {
      throw new Error(`Недостаточно монет на всех адресах кошелька! Набрано: ${accumulatedAmount} / Требуется для отправки: ${totalMojosToSend} mojo`)
    }

    // 2. ФОРМИРОВАНИЕ МАССИВА INPUTS ДЛЯ БЭКЕНДА
    const inputs = selectedItems.map((item: any) => {
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
        wallet_index: item.wallet_index
      }
    })

    // Запоминаем локальный снапшот (walletIndex первой ведущей монеты)
    const snapshot: LocalSnapshot & { walletIndex: number } = {
      targetAddress: targetAddress.trim(),
      mojosToSend: totalMojosToSend,
      feeMojos: totalFeeMojos,
      walletIndex: selectedItems[0].wallet_index
    }
    setLocalSnapshot(snapshot)

    console.log("========= 🟩 ФРОНТЕНД: ПОРЯДКОВЫЙ ПУЛ МОНЕТ (БЕЗ УЧЕТА КОМИССИЙ НА ФРОНТЕ) =========");
    inputs.forEach((item: any, idx: number) => {
      console.log(`[Инпут #${idx}] Index: ${item.wallet_index} | Amount: ${item.coin_to_spend.amount} | Parent: ${item.coin_to_spend.parent_coin_info.slice(0, 16)}...`);
    });
    console.log("========================================================================\n");

    // 3. ОТПРАВКА НА БЭКЕНД
    const res = await fetch("api/v1/transactions/build-spend-bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: inputs,
        send_to_address: snapshot.targetAddress,
        mojos_to_send: snapshot.mojosToSend,
        fee_mojos: snapshot.feeMojos // Передаем значение комиссии чисто информативно, бэк сам применит его внутри спенд-бандла
      })
    })

    const result = await res.json()
    console.log("📥 [КОНСОЛЬ-ЛОГ] Ответ бэка на Шаге 1:", result)
    if (!res.ok || !result.success) throw new Error(result.detail || "Не удалось подготовить транзакцию")

    return {
      ...result,
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
      if (!preparedSpendData?.coin_spends || !pin || !localSnapshot) {
        throw new Error("Критическая ошибка: отсутствуют данные спендов или локальный снапшот!")
      }
      if (pin.length !== 6) throw new Error("ПИН-код должен состоять из 6 цифр")

      console.log("\n========================================================")
      console.log("🔍 [🔍 ШАГ 2] ЗАПУЩЕН МУЛЬТИ-ВХОДНОЙ КРИПТО-АУДИТ (НОВАЯ СТРУКТУРА)...")
      console.log("========================================================")

      const coinSpendsList = preparedSpendData.coin_spends
      if (!coinSpendsList || coinSpendsList.length === 0) {
        throw new Error("Критическая ошибка: Список спендов от бэкенда пуст!")
      }

      // 1. Циклический математический аудит КАЖДОЙ монеты
      for (let i = 0; i < coinSpendsList.length; i++) {
        const item = coinSpendsList[i]
        const coinSource = item.coin
        const parentHex = coinSource.parent_coin_info
        const puzzleHashHex = coinSource.puzzle_hash
        const amountMojo = coinSource.amount

        if (!item.message_to_sign_hex) {
          throw new Error(`Критическая ошибка структуры: отсутствует хэш подписи для монеты #${i}!`)
        }

        const trueCoinId = calculateChiaCoinId(parentHex, puzzleHashHex, amountMojo)
        const fullMessageHex = item.message_to_sign_hex.toLowerCase().trim()
        const coinIdFromMessage = fullMessageHex.substring(64, 128)

        console.log(`📡 [Аудит монеты #${i}]`)
        console.log(`   - Ожидаемый Coin ID: ${trueCoinId}`)
        console.log(`   - Извлеченный из сообщения Coin ID: ${coinIdFromMessage}`)

        if (coinIdFromMessage !== trueCoinId) {
          console.error(`❌ КРИТИЧЕСКАЯ АТАКА! Coin ID не совпали на монете #${i}!`)
          throw new Error(`Критическая ошибка: Обнаружено несоответствие Coin ID на монете #${i}!`)
        }
      }
      console.log("💪 Математический audit всех инпутов пройден успешно!")

      // 🛡️ 2. АУДИТ ЧЕРЕЗ СНАПШОТ И ЗАЩИТА 90%
      console.log("\n📸 Проверяем соответствие данных с локальным снапшотом...")
      if (preparedSpendData.verified_target_address !== localSnapshot.targetAddress) {
        console.error("❌ ПОДМЕНА АДРЕСА: Бэк вернул левый адрес!", preparedSpendData.verified_target_address)
        throw new Error("Критическая ошибка: Конечный адрес получателя изменен бэкендом или перехвачен!")
      }

      const backendTargetMojo = preparedSpendData.verified_mojos_to_send
      const backendNetworkFee = preparedSpendData.audit_info?.summary.fee_network_mojo || 0
      const backendDustFee = preparedSpendData.audit_info?.disposition.dust_fee?.amount_mojo || 0
      const totalBackendOutflow = backendTargetMojo + backendNetworkFee + backendDustFee

      if (totalBackendOutflow !== localSnapshot.mojosToSend) {
        console.error("❌ ПОДМЕНА СУММЫ: Итоговый расход не бьется со снапшотом!", totalBackendOutflow, localSnapshot.mojosToSend)
        throw new Error("Критическая ошибка: Итоговая сумма списания изменена бэкендом или перехвачена!")
      }

      // 🎯 ЗАЩИТА СЛИППИДЖА (90%): Получатель должен получить не менее 90% от исходного инпута
      const minimumAllowedMojo = localSnapshot.mojosToSend * 0.9
      if (backendTargetMojo < minimumAllowedMojo) {
        console.error(`❌ АТАКА НА КОМИССИИ: Получателю долетает слишком мало! Назначено: ${backendTargetMojo}, Минимум: ${minimumAllowedMojo}`)
        throw new Error("Критическая ошибка: Суммарные комиссии превышили порог в 10% от суммы отправки!")
      }
      console.log("💪 Снапшот-аудит и защита от проскальзывания пройдены успешно!")
      // 3. ДЕТАЛЬНОЕ ПОДПИСАНИЕ С АБСОЛЮТНОЙ СИНХРОНИЗАЦИЕЙ ИНДЕКСОВ CHIA
      setStatusMessage("🔐 Подписание транзакции...")
      const clearMnemonic = await getMnemonicForSigning(pin)

      console.log("\n🔑 [КРИПТОГРАФИЯ: ПОСЛЕДОВАТЕЛЬНЫЙ МУЛЬТИ-ПОДПИСНЫЙ ЦИКЛ С ИЗОЛЯЦИЕЙ MEMORY]")
      const signatures: string[] = []

      for (let idx = 0; idx < coinSpendsList.length; idx++) {
        const item = coinSpendsList[idx]
        const currentWalletIndex = item.wallet_index
        const msgHex = item.message_to_sign_hex

        if (currentWalletIndex === undefined || currentWalletIndex === null) {
          throw new Error(`Критическая ошибка структуры: отсутствует индекс деривации внутри спенда #${idx}!`)
        }

        console.log(`\n 📦 [ОЧЕРЕДЬ idx:${idx}] Подготовка таски. Истинный индекс деривации: ${currentWalletIndex}`);
        console.log(`   • Сообщение (первые 16 симв.): ${msgHex.substring(0, 16)}...`);

        const sig = await new Promise<string>((resolve, reject) => {
          Promise.resolve().then(() => {
            try {
              console.log(`   ⚡ [EXECUTION idx:${idx}] Вызывается signChiaTransaction!`);
              const resultSig = signChiaTransaction({
                mnemonic: clearMnemonic,
                walletIndex: Number(currentWalletIndex),
                messageHex: msgHex,
                syntheticOffsetHex: item.synthetic_offset_hex,
              });
              console.log(`     ✅ Подпись сгенерирована: ${resultSig.substring(0, 32)}...`);
              resolve(resultSig);
            } catch (err) {
              console.error(`     ❌ Ошибка внутри функции подписи для idx:${idx}`, err);
              reject(err);
            }
          });
        });
        signatures.push(sig);
      }
      console.log("💪 Все подписи успешно собраны в строгом порядке!")

      const cleanCoinSpends = coinSpendsList.map((cs: any) => ({
        wallet_index: cs.wallet_index,
        synthetic_offset_hex: cs.synthetic_offset_hex,
        coin: {
          parent_coin_info: cs.coin.parent_coin_info,
          puzzle_hash: cs.coin.puzzle_hash,
          amount: cs.coin.amount
        },
        puzzle_reveal: cs.puzzle_reveal,
        solution: cs.solution
      }))

      const flatMessagesList = coinSpendsList.map((cs: any) => cs.message_to_sign_hex)
      const payloadToSend = {
        signatures_list: signatures,
        coin_spends: cleanCoinSpends,
        integrity_token: preparedSpendData.integrity_token,
        messages_signed_hex: flatMessagesList
      }

      // 🛡️ 🎯 ПРОВЕРКА ОТ ДАБЛ-КЛИКА ПЕРЕД ОТПРАВКОЙ НА СЕРВЕР
      const transactionFingerprint = flatMessagesList.join("|")
      if (sentTransactionsRef.current.has(transactionFingerprint)) {
        console.warn("⚠️ [БЛОКИРОВКА] Попытка повторной отправки дублирующего запроса!")
        throw new Error("Вы уже подписали и отправили эту транзакцию. Дождитесь ответа ноды.")
      }
      // Фиксируем отправку в ref
      sentTransactionsRef.current.add(transactionFingerprint)

      setStatusMessage("🚀 Отправка пакета трат в сеть...")

      const res = await fetch("/api/v1/transactions/send-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend)
      })

      const result = await res.json()
      console.log("📥 [КОНСОЛЬ-ЛОГ] Финальный ответ бэка на Шаге 2:", result)

      if (!res.ok || !result.success) {
        // Если нода вернула ошибку, снимаем блок из ref, чтобы можно было попробовать снова
        sentTransactionsRef.current.delete(transactionFingerprint)
        throw new Error(result.error || result.detail || "Нода отклонила транзакцию")
      }
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

      // 1. 🛡️ ФИКС ЗАВИСАНИЯ СТАТУСА: Снимаем зависший текст загрузки и выводим текст ошибки
      setStatusMessage(`❌ Ошибка: ${err.message || "Транзакция отклонена"}`)

      // 2. 🔐 СНЯТИЕ БЛОКИРОВКИ КЛИКА: Если спенды были, гарантированно вычищаем отпечаток из ref,
      // чтобы юзер мог исправить данные/ПИН и отправить форму повторно без перезагрузки страницы
      if (preparedSpendData?.coin_spends) {
        const transactionFingerprint = preparedSpendData.coin_spends
          .map((cs: any) => cs.message_to_sign_hex)
          .join("|")
        sentTransactionsRef.current.delete(transactionFingerprint)
      }

      // 3. Сброс состояния ввода
      const nextAttempts = pinAttempts + 1
      setPinAttempts(nextAttempts)
      setPin("")
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
