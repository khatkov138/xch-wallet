'use client'

import React, { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWalletAuth } from "@/hooks/useWalletAuth"

interface SendModalProps { isOpen: boolean; onClose: () => void }

export function SendModal({ isOpen, onClose }: SendModalProps) {
  const { walletAddress, getUnhardenedPkHex, getUnhardenedSkHex } = useWalletAuth()
  const [targetAddress, setTargetAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [customFeeMojo, setCustomFeeMojo] = useState("5000000")
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [debugJsonString, setDebugJsonString] = useState("")

  if (!isOpen) return null

  const getFeeInXchString = () => {
    const mojo = parseFloat(customFeeMojo) || 0
    return mojo === 0 ? "0 XCH" : `${(mojo / 1_000_000_000_000).toFixed(12).replace(/\.?0+$/, "")} XCH`
  }

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetAddress || !amount) return

    const targetFeeMojo = parseInt(customFeeMojo) || 0
    if (targetFeeMojo > 0 && targetFeeMojo < 5000000) {
      setStatusMessage("❌ Укажите комиссию 0 или не менее 5 000 000 Mojo!")
      return
    }

    setLoading(true); setStatusMessage(""); setDebugJsonString("")
    const debugApiUrl = "/api/chia/debug"

    let dump: any = {
      client_context: { wallet_address: walletAddress, target_address: targetAddress.trim(), amount_xch: amount, fee_mojo: targetFeeMojo },
      step1_sent: null, step1_received: null,
      step2_sent: null, step2_received: null,
      step3_sent: null, step3_received: null,
      step4_sent: null, step4_received: null
    }

    try {
      const amountMojo = Math.floor(parseFloat(amount) * 1_000_000_000_000)

      // 🔍 ИНСПЕКЦИЯ КЛЮЧЕЙ В КОНСОЛИ БРАУЗЕРА (F12)
      const pk = getUnhardenedPkHex?.()
      const sk = getUnhardenedSkHex?.()

      console.log("%c🔑 [CHIA KEY INSPECTOR] ПРОВЕРКА КЛЮЧЕЙ ХУКА КОНТЕКСТА:", "color: #ff00ff; font-weight: bold;")
      console.log("   👉 Твой текущий адрес (с хука):", walletAddress)
      console.log("   👉 Публичный ключ (PK Hex):", pk)
      console.log("   👉 Длина PK:", pk ? pk.length : 0, "символов")
      console.log("   👉 Приватный ключ (SK Hex поднят):", sk ? `${sk.slice(0, 8)}...` : "НЕТ КЛЮЧА")
      console.log("──────────────────────────────────────────────────")

      if (!pk || !sk) throw new Error("Ошибка context ключей — хук вернул пустые значения")

      // ==========================================
      // ШАГ 1: Получение UTXO монет
      // ==========================================
      setStatusMessage("1/4 Запрос UTXO монет...")
      dump.step1_sent = { puzzle_hash: walletAddress, amount: amountMojo, fee: targetFeeMojo, network: "testnet11" }

      console.log("=== [STEP1 OUT] ОТПРАВЛЯЕМ ===", dump.step1_sent)
      const r1 = await fetch(`${debugApiUrl}/step1`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dump.step1_sent) })
      const d1 = await r1.json()
      console.log("=== [STEP1 IN] ПОЛУЧИЛИ ===", d1)

      dump.step1_received = d1
      if (!r1.ok) throw new Error(d1.error || d1.detail || "Сбой Шага 1")

      // ==========================================
      // ШАГ 2: Сборка CLVM структур и условий трат
      // ==========================================
      setStatusMessage("2/4 Сборка солюшена CLVM...")
      dump.step2_sent = {
        selected_coins: d1.selected_coins,
        target_address_ph: targetAddress.trim(),
        change_address_ph: d1.sender_puzzle_hash,
        amount: amountMojo,
        fee: targetFeeMojo,
        public_key: pk,
        wallet_sk_hex: sk // 👈 ПРОСТО ДОБАВЬ СЮДА ЭТУ СТРОКУ
      }
      console.log("=== [STEP2 OUT] ОТПРАВЛЯЕМ ===", dump.step2_sent)
      const r2 = await fetch(`${debugApiUrl}/step2`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dump.step2_sent) })
      const d2 = await r2.json()
      console.log("=== [STEP2 IN] ПОЛУЧИЛИ ===", d2)

      dump.step2_received = d2
      if (!r2.ok) throw new Error(d2.error || d2.detail || "Сбой Шага 2")

      // ==========================================
      // ШАГ 3: Расчет хешей AGG_SIG_ME и BLS подписание
      // ==========================================
      setStatusMessage("3/4 BLS подписание...")
      dump.step3_sent = {
        coin_spends: d2.coin_spends,
        genesis_challenge: "0d6c3eda25350189907651ec99e46fa69c5e36d4086f8a9c569014a7300961d0",
        wallet_sk_hex: sk,
        rpc_signature: d2.rpc_signature // 👈 ДОБАВЬ ТОЛЬКО ЭТУ СТРОКУ
      }
      console.log("=== [STEP3 OUT] ОТПРАВЛЯЕМ ===", dump.step3_sent)
      const r3 = await fetch(`${debugApiUrl}/step3`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dump.step3_sent) })
      const d3 = await r3.json()
      console.log("=== [STEP3 IN] ПОЛУЧИЛИ ===", d3)

      const finalSignature = d3.aggregated_signature || d3.signature
      if (!finalSignature) throw new Error("Агрегированная BLS подпись не найдена в ответе Шага 3")

      // ==========================================
      // ШАГ 4: Пуш готового SpendBundle в полную ноду Chia
      // ==========================================
      setStatusMessage("4/4 Пуш SpendBundle в ноду...")
      dump.step4_sent = {
        coin_spends: d2.coin_spends,
        aggregated_signature: finalSignature,
        network: "testnet11",
        node_url: "https://localhost:8555"
      }

      console.log("=== [STEP4 OUT] ОТПРАВЛЯЕМ ===", dump.step4_sent)
      const r4 = await fetch(`${debugApiUrl}/step4`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dump.step4_sent) })
      const d4 = await r4.json()
      console.log("=== [STEP4 IN] ПОЛУЧИЛИ ===", d4)

      dump.step4_received = d4
      if (!r4.ok || d4.success === false) throw new Error(d4.error || d4.detail || "Мемпул ноды отклонил транзакцию")

      setStatusMessage("🎉 Успешно! Транзакция в мемпуле!")
      setDebugJsonString(JSON.stringify(dump, null, 2))
    } catch (err: any) {
      setStatusMessage(`❌ Ошибка: ${err.message || err}`)
      setDebugJsonString(JSON.stringify(dump, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl max-h-[95vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer">
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold mb-4 tracking-tight">Отправить XCH</h3>

        <form onSubmit={handleSendTransaction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Адрес получателя</label>
            <input
              type="text" placeholder="txch1..." value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)} disabled={loading}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50" required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Сумма (XCH)</label>
            <input
              type="number" step="0.000000000001" placeholder="0.00" value={amount}
              onChange={(e) => setAmount(e.target.value)} disabled={loading}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50" required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Комиссия (Mojo)</label>
            <input
              type="number" step="1" min="0" placeholder="5000000" value={customFeeMojo}
              onChange={(e) => setCustomFeeMojo(e.target.value)} disabled={loading}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50 font-mono"
            />
            <span className="block text-[10px] text-zinc-500 font-medium mt-1.5 pl-1">
              ≈ {getFeeInXchString()} (1 XCH = 1 000 000 000 000 Mojo)
            </span>
          </div>

          {statusMessage && (
            <div className="text-xs text-center font-medium bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300 max-h-16 overflow-y-auto whitespace-pre-wrap">
              {statusMessage}
            </div>
          )}

          {debugJsonString && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-orange-400 pl-1">📋 Сквозной JSON-Лог (Ctrl+A  Ctrl+C):</label>
              <textarea
                readOnly value={debugJsonString}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-32 bg-zinc-950 text-green-400 font-mono text-[9px] p-2 rounded-xl border border-zinc-800 resize-none focus:outline-none cursor-pointer"
              />
            </div>
          )}

          <Button
            type="submit" disabled={loading || !targetAddress || !amount}
            className="w-full h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Подписать и отправить"}
          </Button>
        </form>
      </div>
    </div>
  )
}
