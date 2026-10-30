'use client'

import React, { useState, useEffect } from "react"
import bip39 from 'bip39'
import chiaBls from 'chia-bls'
import { useWalletSession } from "@/store/useWalletStore"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { chiaDeriveChildSkUnhardened, calculateSyntheticSecretKey } from "@/utils/crypto"
import { Button } from "@/components/ui/button"
import { Loader2, X } from "lucide-react"

// Достаем структуры согласно спецификации node-chia-bls
const { PrivateKey, AugSchemeMPL } = chiaBls

interface SendModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SendModal({ isOpen, onClose }: SendModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [targetAddress, setTargetAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [customFeeMojo, setCustomFeeMojo] = useState("5000000")
  const [pin, setPin] = useState("")
  const [pinAttempts, setPinAttempts] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [debugJsonString, setDebugJsonString] = useState("")
  const [preparedSpendData, setPreparedSpendData] = useState<any>(null)

  // 🎯 ИСПОЛЬЗУЕМ ХУКИ: Диспетчер для подписи и Датчик для публичного ключа
  const { getMnemonicForSigning } = useWalletAuth()
  const masterPkHex = useWalletSession((state) => state.unhardenedPkHex)

  useEffect(() => {
    if (!isOpen) {
      setPin(""); setStep(1); setStatusMessage(""); setDebugJsonString(""); setPreparedSpendData(null); setPinAttempts(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const getFeeInXchString = () => {
    const mojo = parseFloat(customFeeMojo) || 0
    return mojo === 0 ? "0 XCH" : `${(mojo / 1_000_000_000_000).toFixed(12).replace(/\.?0+$/, "")} XCH`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    // --- ШАГ 1: Поиск монет и сборка бандла на бэкенде ---
    if (step === 1) {
      if (!targetAddress || !amount) return
      setLoading(true); setStatusMessage(""); setDebugJsonString("")
      try {
        if (!masterPkHex) throw new Error("Сессия не найдена")
        const xch = parseFloat(amount.trim().replace(",", "."))
        if (isNaN(xch) || xch <= 0) throw new Error("Введите корректную сумму")

        setStatusMessage("⏳ Поиск монет на контракте...")

        const res = await fetch("http://localhost:8000/api/v1/transactions/build-spend-bundle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            master_pk_hex: masterPkHex,
            send_to_address: targetAddress.trim(),
            mojos_to_send: Math.round(xch * 1_000_000_000_000),
            fee_mojos: parseInt(customFeeMojo.trim() || "0", 10)
          })
        })

        const result = await res.json()
        setDebugJsonString(JSON.stringify(result, null, 2))

        if (!res.ok || !result.success) throw new Error(result.detail || "Не удалось подготовить трату")

        setPreparedSpendData(result)
        setStep(2)
        setStatusMessage("")
      } catch (err: any) {
        setStatusMessage(`❌ Ошибка: ${err.message || err}`)
      } finally {
        setLoading(false)
      }

      // --- ШАГ 2: Ввод ПИН, безопасная деривация и отправка подписи на бэк ---
    } else {
      // 🛡️ Безопасная проверка индекса 0 через оператор нулевого слияния
      if ((preparedSpendData?.target_wallet_index ?? null) === null || !pin) return
      if (pin.length !== 6) return setStatusMessage("❌ ПИН-код должен состоять из 6 цифр")

      setLoading(true); setStatusMessage("")
      try {
        setStatusMessage("🔐 Авторизация контракта и подписание...")

        // Получаем чистую фразу из изолированного метода
        const clearMnemonic = await getMnemonicForSigning(pin)

        // Восстанавливаем приватный корень
        const seed = bip39.mnemonicToSeedSync(clearMnemonic.trim())
        const masterSk = PrivateKey.fromSeed(seed)

        // Деривация стандартной некостодиальной ветки Chia
        let walletBranchSk = masterSk
        walletBranchSk = chiaDeriveChildSkUnhardened(walletBranchSk, 12381)
        walletBranchSk = chiaDeriveChildSkUnhardened(walletBranchSk, 8444)
        walletBranchSk = chiaDeriveChildSkUnhardened(walletBranchSk, 2)

        // Получаем приватник нужного индекса
        const targetSk = chiaDeriveChildSkUnhardened(walletBranchSk, preparedSpendData.target_wallet_index)

        // Превращаем ключ в синтетический на фронтенде (криптографический сдвиг под Chia стандарт)
        const syntheticSk = calculateSyntheticSecretKey(
          targetSk,
          preparedSpendData.hidden_puzzle_hash_hex // 🔥 Передаем хэш, прилетевший с бэка
        )

        // Подписываем через AugSchemeMPL
        const messageBytes = Buffer.from(preparedSpendData.message_to_sign_hex, 'hex')
        const signature = AugSchemeMPL.sign(syntheticSk, messageBytes)
        const signatureHex = Buffer.from(signature.toBytes()).toString('hex')

        // Подписываем хэш транзакции через нативную схему AugSchemeMPL


        // ================= 🔬 КРИПТОГРАФИЧЕСКИЙ ДЕБАГ-ЦЕНТР =================
        console.log("=== [FRONT] START CRYPTO DEBUG (INDEX 0) ===");
        console.log("[FRONT] Master PK Hex (из стора):", masterPkHex);

        // Проверяем публичный ключ ПЕРЕД синтетическим сдвигом (чистая деривация веток)
        const targetPkHex = Buffer.from(targetSk.getG1().toBytes()).toString('hex');
        console.log("[FRONT] Target PK Hex (индекс " + preparedSpendData.target_wallet_index + "):", targetPkHex);

        // Проверяем публичный ключ ПОСЛЕ синтетического сдвига
        const syntheticPkHex = Buffer.from(syntheticSk.getG1().toBytes()).toString('hex');
        console.log("[FRONT] Synthetic PK Hex (готовый под паззл):", syntheticPkHex);
        console.log("======================================================");



        setStatusMessage("🚀 Отправка пакета трат в сеть...")

        // Явно собираем структуру, соответствующую ожиданиям бэкенда
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
            coin_spend: cleanCoinSpend // Отправляем идеально структурированный объект
          })
        })

        const result = await res.json()
        setDebugJsonString(JSON.stringify(result, null, 2))

        if (!res.ok || !result.success) throw new Error(result.detail || "Нода отклонила транзакцию")

        setStatusMessage("🎉 Успешно! Монеты отправлены!")
        setPin(""); setPinAttempts(0)
      } catch (err: any) {
        const nextAttempts = pinAttempts + 1
        setPinAttempts(nextAttempts); setPin("")
        if (nextAttempts >= 3) {
          onClose()
        } else {
          setStatusMessage(`❌ Неверный ПИН-код или ошибка подписи! Осталось попыток: ${3 - nextAttempts}\n${err.message || err}`)
        }
      } finally {
        setLoading(false)
      }
    }
  }

  // Здесь возвращается твоя вёрстка без изменений...
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl max-h-[95vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"><X size={18} /></button>
        <h3 className="text-lg font-bold mb-4 tracking-tight">Отправить XCH</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Адрес получателя</label>
                <input type="text" placeholder="txch1..." value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Сумма (XCH)</label>
                <input type="number" step="0.000000000001" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Комиссия (Mojo)</label>
                <input type="number" step="1" min="0" placeholder="5000000" value={customFeeMojo} onChange={(e) => setCustomFeeMojo(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50 font-mono" />
                <span className="block text-[10px] text-zinc-500 font-medium mt-1.5 pl-1">≈ {getFeeInXchString()} (1 XCH = 1 000 000 000 000 Mojo)</span>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="bg-zinc-950 p-4 rounded-xl space-y-2 text-xs">
                <div className="break-all"><span className="text-zinc-400">Получатель:</span> {targetAddress}</div>
                <div><span className="text-zinc-400">Сумма:</span> {amount} XCH</div>
                <div className="break-all"><span className="text-zinc-400">Хеш (msgHex):</span> <span className="font-mono text-orange-400">{preparedSpendData?.message_to_sign_hex}</span></div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Введите ПИН-код кошелька</label>
                <input type="password" maxLength={6} placeholder="••••••" value={pin} onChange={(e) => setPin(e.target.value)} disabled={loading} autoFocus className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-center tracking-widest focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50" required />
              </div>
            </>
          )}
          {statusMessage && <div className="text-xs text-center font-medium bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300 max-h-24 overflow-y-auto whitespace-pre-wrap">{statusMessage}</div>}
          {debugJsonString && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-orange-400 pl-1">📋 Сквозной JSON-Лог:</label>
              <textarea readOnly value={debugJsonString} onClick={(e: any) => e.target.select()} className="w-full h-32 bg-zinc-950 text-green-400 font-mono text-[9px] p-2 rounded-xl border border-zinc-800 resize-none focus:outline-none cursor-pointer" />
            </div>
          )}
          {step === 1 ? (
            <Button type="submit" disabled={loading || !targetAddress || !amount} className="w-full h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer">
              {loading ? <Loader2 size={14} className="animate-spin text-black" /> : "Проверить монеты и собрать контракт"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={loading} onClick={() => setStep(1)} className="w-1/3 h-12 rounded-xl text-xs font-bold cursor-pointer">Назад</Button>
              <Button type="submit" disabled={loading || !pin} className="w-2/3 h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
                {loading ? <Loader2 size={14} className="animate-spin text-black" /> : "Подписать контракт и отправить"}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

