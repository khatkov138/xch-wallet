'use client'

import React, { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import chiaBls from "chia-bls"

const { PrivateKey, AugSchemeMPL } = chiaBls;

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const toBytes = (h: string) => {
  const c = h.replace(/^0x|\s+/g, '').toLowerCase();
  return new Uint8Array(c.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
};

const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');

export function SendModal({ isOpen, onClose }: SendModalProps) {
  const { getUnhardenedPkHex, getUnhardenedSkHex, decryptedPhrase } = useWalletAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [targetAddress, setTargetAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [customFeeMojo, setCustomFeeMojo] = useState("5000000")
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [debugJsonString, setDebugJsonString] = useState("")
  const [preparedSpendData, setPreparedSpendData] = useState<any>(null)

  if (!isOpen) return null

  const getFeeInXchString = () => {
    const mojo = parseFloat(customFeeMojo) || 0
    return mojo === 0 ? "0 XCH" : `${(mojo / 1_000_000_000_000).toFixed(12).replace(/\.?0+$/, "")} XCH`
  }

  const handlePrepareCoinSpend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetAddress || !decryptedPhrase) return

    setLoading(true)
    setStatusMessage("")
    setDebugJsonString("")

    try {
      setStatusMessage("⏳ Поиск монет на контракте и генерация структуры трат...")
      const walletPublicKeyHex = getUnhardenedPkHex()
      if (!walletPublicKeyHex) throw new Error("Не удалось получить публичный ключ кошелька из сессии")

      const response = await fetch("/api/coin/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: targetAddress.trim(), publicKeyHex: walletPublicKeyHex }) })
      const result = await response.json()
      setDebugJsonString(JSON.stringify(result, null, 2))

      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось подготовить трату монеты")

      setPreparedSpendData(result.spendData)
      setStep(2)
    } catch (err: any) {
      setStatusMessage(`❌ Ошибка подготовки: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }
  const handleSignAndSubmit = async () => {
    if (!preparedSpendData || !preparedSpendData.msgHex) return;

    setLoading(true);
    setStatusMessage("");

    try {
      setStatusMessage("🔐 Локальное подписание контракта приватным ключом...");

      // 1. Получаем HEX приватного ключа из твоего хука ( wallet_sk_hardened_hex )
      const walletPrivateKeyHex = getUnhardenedSkHex();
      if (!walletPrivateKeyHex) throw new Error("Приватный ключ недоступен. Возможно, экран заблокирован");

      // 2. Инициализируем приватный ключ BLS из HEX-байтов (в роуте было PrivateKey.fromSeed)
      const sk = PrivateKey.fromBytes(toBytes(walletPrivateKeyHex));

      // 3. Переводим msgHex от бэкенда обратно в байты Uint8Array
      const msgBytes = toBytes(preparedSpendData.msgHex);

      // 4. Подписываем сообщение точно так же, как это делалось в роуте
      const signature = AugSchemeMPL.sign(sk, msgBytes);
      const aggregatedSignatureHex = "0x" + toHex(signature.toBytes());

      // 5. Упаковываем coinSpend из бэкенда и нашу подпись в SpendBundle
      const spendBundle = { coin_spends: [preparedSpendData.coinSpend], aggregated_signature: aggregatedSignatureHex };
      setDebugJsonString(JSON.stringify({ message: "Сформирован SpendBundle", spend_bundle: spendBundle }, null, 2));
      setStatusMessage("🚀 Контракт подписан локально! Отправка пакета трат в сеть...");

      // 6. Отправляем готовый SpendBundle на эндпоинт отправки
      const submitResponse = await fetch("/api/coin/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spend_bundle: spendBundle }) });
      const submitResult = await submitResponse.json();
      setDebugJsonString(JSON.stringify(submitResult, null, 2));

      if (!submitResponse.ok || !submitResult.success) throw new Error(submitResult.error || "Нода отклонила SpendBundle");

      setStatusMessage("🎉 Успешно! Монеты отправлены, пакет трат в мемпуле ноды!");
    } catch (err: any) {
      setStatusMessage(`❌ Ошибка отправки: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl max-h-[95vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer">
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold mb-4 tracking-tight">Отправить XCH</h3>

        {step === 1 ? (
          <form onSubmit={handlePrepareCoinSpend} className="space-y-4">
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
              <div className="text-xs text-center font-medium bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
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
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Проверить монеты и собрать контракт"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-zinc-950 p-4 rounded-xl space-y-2 text-xs">
              <div><span className="text-zinc-400">Получатель:</span> {targetAddress}</div>
              <div><span className="text-zinc-400">Сумма:</span> {amount} XCH</div>
              <div><span className="text-zinc-400">Хеш (msgHex):</span> <span className="font-mono text-orange-400">{preparedSpendData?.msgHex}</span></div>
            </div>

            {statusMessage && (
              <div className="text-xs text-center font-medium bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
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

            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={loading} onClick={() => setStep(1)} className="w-1/3 h-12 rounded-xl text-xs font-bold">Назад</Button>
              <Button type="button" disabled={loading} onClick={handleSignAndSubmit} className="w-2/3 h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs">
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Подписать контракт и отправить"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
