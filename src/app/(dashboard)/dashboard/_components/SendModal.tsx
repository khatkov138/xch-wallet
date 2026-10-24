'use client'

import React, { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWalletStore } from "@/store/useWalletStore"
import { useWalletAuth } from "@/hooks/useWalletAuth" // Импортируем ваш хук

interface SendModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SendModal({ isOpen, onClose }: SendModalProps) {
  const { walletAddress } = useWalletStore()

  // Забираем каноничную подпись и оффлайн-генератор паблика прямо из хука сессии
  const { signMessage, getUnhardenedPkHex } = useWalletAuth()

  const [targetAddress, setTargetAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [customFeeMojo, setCustomFeeMojo] = useState("5000000") // 5M по умолчанию против ошибки too close to zero
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  if (!isOpen) return null

  // Функция для динамического пересчета Mojo в чистый XCH на лету
  const getFeeInXchString = () => {
    const mojo = parseFloat(customFeeMojo) || 0
    if (mojo === 0) return "0 XCH"
    const xch = mojo / 1_000_000_000_000
    return `${xch.toFixed(12).replace(/\.?0+$/, "")} XCH`
  }

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetAddress || !amount) return

    const targetFeeMojo = parseInt(customFeeMojo) || 0

    if (targetFeeMojo > 0 && targetFeeMojo < 5000000) {
      setStatusMessage("❌ Ошибка: Укажите комиссию 0 или не менее 5 000 000 Mojo!")
      return
    }

    setLoading(true)
    setStatusMessage("1/3 Сборка транзакции на бэкенде...")

    try {
      // Генерируем Unhardened Wallet PK Hex из оперативной памяти хука
      const computedPkHex = getUnhardenedPkHex()
      if (!computedPkHex) {
        throw new Error("Не удалось рассчитать публичный ключ. Сессия заблокирована.")
      }

      // 1. Запрос к бэкенду. Передаем РЕАЛЬНУЮ ручную комиссию и некастодиальный PK
      const buildResponse = await fetch("/api/chia/build-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unhardened_pk: computedPkHex, // ИСПРАВЛЕНО: уходим от серверного wallet_id
          target_address: targetAddress.trim(),
          amount_mojo: Math.floor(parseFloat(amount) * 1_000_000_000_000),
          fee_mojo: targetFeeMojo
        }),
      })

      if (!buildResponse.ok) {
        const errData = await buildResponse.json()
        throw new Error(errData.message || "Не удалось собрать транзакцию на бэкенде")
      }

      const buildData = await buildResponse.json()

      if (buildData.status === "error") {
        throw new Error(buildData.message || "Ошибка генерации на бэкенде")
      }

      // ВЕРНУЛИ ЛОГИ ЭТАПА 1
      console.log("%c 🚀 [XCHA FRONTEND - ЭТАП 1: ИСХОДНЫЕ ДАННЫЕ С БЭКЕНДА] ", "background: #2563EB; color: white; font-weight: bold; padding: 4px; border-radius: 4px;")
      console.log("1. Message Hash Hex для подписи:", buildData.message_hash_hex)
      console.log("2. Установленная вручную комиссия:", targetFeeMojo)
      console.log("3. Параметры транзакции (tx_data):", JSON.stringify(buildData.tx_data, null, 2))
      console.log("%c ---------------------------------------------------------------- ", "color: #52525b;")

      const messageHashHex = buildData.message_hash_hex
      if (!messageHashHex) throw new Error("Бэкенд не вернул хэш сообщения")

      setStatusMessage("2/3 Криптография на клиенте: ЭТАП 2...")

      // 2. Локальное подписание хэша сообщения
      const signatureHex = signMessage(messageHashHex)
      if (!signatureHex) throw new Error("Критическая ошибка: локальная подпись провалена")

      setStatusMessage("3/3 Отправка транзакции в сеть...")

      // 3. Отправка транзакции вместе с подписью обратно на бэкенд для push_tx
      const pushResponse = await fetch("/api/chia/submit-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_data: buildData.tx_data,
          signature: signatureHex,
        }),
      })

      if (!pushResponse.ok) {
        const errData = await pushResponse.json()
        throw new Error(errData.message || "Ошибка при трансляции в сеть на уровне API")
      }

      const pushData = await pushResponse.json()

      // ВЕРНУЛИ ЛОГИ ЭТАПА 3
      console.log("%c 📡 [XCHA FRONTEND - ЭТАП 3: ЧИСТЫЙ ОТВЕТ ОТ API И FULL NODE] ", "background: #F59E0B; color: black; font-weight: bold; padding: 4px; border-radius: 4px;")
      console.log(JSON.stringify(pushData, null, 2))
      console.log("%c ---------------------------------------------------------------- ", "color: #52525b;")

      if (pushData.status !== "success") {
        const nodeReason = pushData.rpc_response?.error || pushData.message || "Мемпул отклонил транзакцию"
        throw new Error(nodeReason)
      }

      setStatusMessage("🎉 Транзакция успешно отправлена!")
      setTimeout(() => {
        onClose()
        setTargetAddress("")
        setAmount("")
        setCustomFeeMojo("5000000")
        setStatusMessage("")
      }, 3000)

    } catch (err: any) {
      console.error("%c ❌ [XCHA FRONTEND ERROR] ", "background: #EF4444; color: white; font-weight: bold; padding: 2px;", err)
      setStatusMessage(`❌ Ошибка: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer">
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold mb-4 tracking-tight">Отправить XCH</h3>

        <form onSubmit={handleSendTransaction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Адрес получателя</label>
            <input
              type="text"
              placeholder="txch1..."
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              disabled={loading}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Сумма (XCH)</label>
            <input
              type="number"
              step="0.000000000001"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50"
              required
            />
          </div>

          {/* ========================================================================= */}
          {/* СЕКЦИЯ РУЧНОГО ВВОДА КОМИССИИ В MOJO (ИНПУТ В СТИЛЕ ОСТАЛЬНЫХ ПОЛЕЙ) */}
          {/* ========================================================================= */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Комиссия (Mojo)</label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="Введите комиссию, например 50000000"
              value={customFeeMojo}
              onChange={(e) => setCustomFeeMojo(e.target.value)}
              disabled={loading}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50 font-mono"
            />
            {/* Наш калькулятор под инпутом */}
            <span className="block text-[10px] text-zinc-500 font-medium mt-1.5 pl-1">
              ≈ {getFeeInXchString()} (1 XCH = 1 000 000 000 000 Mojo)
            </span>
          </div>

          {statusMessage && (
            <div className="text-xs text-center font-medium bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300">
              {statusMessage}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !targetAddress || !amount}
            className="w-full h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Подписать и отправить"}
          </Button>
        </form>
      </div>
    </div>
  )
}
