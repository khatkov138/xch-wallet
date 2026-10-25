import React, { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWalletAuth } from "@/hooks/useWalletAuth"

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PYTHON_BACKEND_URL = "http://127.0.0.1:8000"

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

    setLoading(true)
    setStatusMessage("")
    setDebugJsonString("")

    let dump: any = {
      client_context: { wallet_address: walletAddress, target_address: targetAddress.trim(), amount_xch: amount, fee_mojo: targetFeeMojo },
      step1_sent: null, step1_received: null,
      step2_sent: null, step2_received: null,
      step3_sent: null, step3_received: null,
      step4_sent: null, step4_received: null
    }

    try {
      const amountMojo = Math.floor(parseFloat(amount) * 1_000_000_000_000)

      const pk = getUnhardenedPkHex()
      const sk = getUnhardenedSkHex()

      // ИСПРАВЛЕНО: Красивое текстовое логирование перед отправкой для сверки с аудитом
      console.log(
        `%c🚀 [XCHA TX PRE-FLIGHT INSPECTOR]\n` +
        `----------------------------------------\n` +
        `🌍 Текущий адрес:       ${walletAddress}\n` +
        `🔑 Canonical Wallet PK:  ${pk}\n` +
        `🔒 Canonical Wallet SK:  ${sk ? `${sk.slice(0, 10)}...${sk.slice(-10)}` : "НЕТ КЛЮЧА"}\n` +
        `📥 Куда отправляем:      ${targetAddress.trim()}\n` +
        `💰 Сумма (Mojo):         ${amountMojo}\n` +
        `⛽ Комиссия (Mojo):      ${targetFeeMojo}\n` +
        `----------------------------------------`,
        "color: #ff00ff; font-weight: bold; font-family: monospace;"
      )

      if (!pk || !sk) throw new Error("Ошибка context ключей — хук вернул пустые значения")

      setStatusMessage("⏳ Отправка сквозного запроса 4-в-1 на бэкенд...")

      const strictPayload = {
        amount: amountMojo,
        fee: targetFeeMojo
      }

      console.log(`📡 [API REQUEST] -> POST ${PYTHON_BACKEND_URL}/send-transaction`, strictPayload)

      const response = await fetch(`${PYTHON_BACKEND_URL}/send-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strictPayload) // Теперь летят только два чистых инта!
      })

      const result = await response.json()

      if (result.debug_flow) {
        dump.step1_sent = result.debug_flow.step1_sent
        dump.step1_received = result.debug_flow.step1_received
        dump.step2_sent = result.debug_flow.step2_sent
        dump.step2_received = result.debug_flow.step2_received
        dump.step3_sent = result.debug_flow.step3_sent
        dump.step3_received = result.debug_flow.step3_received
        dump.step4_sent = result.debug_flow.step4_sent
        dump.step4_received = result.debug_flow.step4_received
      }

      console.log(
        `%c📥 [API RESPONSE] <- Status: ${response.status}\n` +
        `📄 Data: ${JSON.stringify(result, null, 2)}`,
        result.status === "success" ? "color: #10B981; font-family: monospace;" : "color: #EF4444; font-family: monospace;"
      )

      if (!response.ok || result.status !== "success") {
        throw new Error(result.detail || result.error || "Мемпул ноды отклонил транзакцию")
      }

      setStatusMessage(`🎉 Успешно! Транзакция в мемпуле! ID: ${result.tx_id}`)
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
