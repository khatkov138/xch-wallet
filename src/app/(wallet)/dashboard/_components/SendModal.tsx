'use client'
import React, { useState, useEffect } from "react"
import { useSendTransaction } from "@/hooks/useSendTransaction"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { useWalletFees } from "@/hooks/useWalletFees" // Наш новый ленивый хук
import { Button } from "@/components/ui/button"
import { Loader2, X, AlertCircle, TrendingDown, ShieldCheck, Zap } from "lucide-react"
import { renderHighlightedAddress } from "@/lib/utils/ui"
import { UtxoCard } from "./UtxoCard"

interface SendModalProps { isOpen: boolean; onClose: () => void }
type FeeTier = "low" | "medium" | "high"

export function SendModal({ isOpen, onClose }: SendModalProps) {
  const [targetAddress, setTargetAddress] = useState(""), [amount, setAmount] = useState("")
  const [selectedTier, setSelectedTier] = useState<FeeTier>("medium")
  const [customFeeMojo, setCustomFeeMojo] = useState<string>("0"), [pin, setPin] = useState("")
  const { unspentCoins, addresses } = useWalletDashboard()

  // 🎯 Алиас под твою переменную: данные подгружаются лениво при открытии модалки
  const { data: dynamicFees } = useWalletFees(isOpen)

  const { step, setStep, loading, statusMessage, handleSubmit, resetHooksState, preparedSpendData } = useSendTransaction({
    targetAddress, amount, customFeeMojo, pin, setPin, onClose, unspentCoins, walletAddresses: addresses
  })

  // Синхронизация при открытии/закрытии модалки
  useEffect(() => {
    if (!isOpen) { setTargetAddress(""); setAmount(""); setSelectedTier("medium"); setCustomFeeMojo("0"); setPin(""); resetHooksState() }
  }, [isOpen])

  // 🎯 Реактивный пуш mojo выбранного тира напрямую в хук отправки
  useEffect(() => {
    if (dynamicFees) {
      setCustomFeeMojo(String(dynamicFees[selectedTier].mojo))
    }
  }, [selectedTier, dynamicFees])

  const audit = preparedSpendData?.audit_info
  if (!isOpen) return null

  const getFeeInXchString = () => customFeeMojo === "0" ? "0 XCH" : `${(parseFloat(customFeeMojo) / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`
  
  // 🎯 ОРИГИНАЛЬНАЯ СТРОКА ОДИН В ОДИН, КАК У ТЕБЯ
  const getTotalOutflowString = () => `${(parseFloat(amount) || 0).toFixed(4)} XCH`

  // Вспомогательные данные для мапинга кнопок
  const btnConfig = [
    { t: "low", l: "Низкая", icon: TrendingDown, cl: "text-zinc-400" },
    { t: "medium", l: "Средняя 🔥", icon: ShieldCheck, cl: "text-amber-500" },
    { t: "high", l: "Высокая 🚀", icon: Zap, cl: "text-[#FF2E93]" }
  ] as const


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl text-white shadow-2xl flex flex-col md:flex-row items-start p-6 gap-6 max-h-[95vh] overflow-hidden">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer transition-colors z-10"><X size={18} /></button>

        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="w-full md:w-1/2 shrink-0">
          <h3 className="text-lg font-bold mb-4 tracking-tight">Отправить XCH</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <div><label className="block text-xs font-semibold text-zinc-400 mb-1.5">Адрес получателя</label>
                  <input type="text" placeholder="xch1..." value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] text-white" required /></div>
                <div><label className="block text-xs font-semibold text-zinc-400 mb-1.5">Сумма (XCH)</label>
                  <input type="number" step="0.000000000001" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] text-white" required /></div>

                {/* БЛОК КОМИССИЙ С АВТО-БЛОКИРОВКОЙ */}
                <div className="space-y-1.5"><label className="block text-xs font-semibold text-zinc-400">Размер комиссии</label>
                  <div className="grid grid-cols-3 gap-2">
                    {btnConfig.map(({ t, l, icon: Icon, cl }) => {
                      const hasData = !!dynamicFees?.[t];
                      const mojoVal = dynamicFees?.[t]?.mojo ?? 0;
                      const secVal = dynamicFees?.[t]?.seconds ?? 0;

                      // 🎯 ПЕРЕВОД В МИНУТЫ ПРЯМО ПРИ ВЫВОДЕ (60с -> 1 мин, 300с -> 5 мин, 600с -> 10 мин)
                      const minsVal = Math.round(secVal / 60);

                      return (
                        <button key={t} type="button" disabled={loading || !hasData} onClick={() => { setSelectedTier(t); setCustomFeeMojo(String(mojoVal)) }} className={`flex flex-col items-center py-2 px-1 rounded-xl border text-center text-white text-xs transition-all ${!hasData ? "opacity-40 bg-zinc-950 border-zinc-900 cursor-not-allowed" : selectedTier === t ? "bg-zinc-800 border-zinc-700 shadow-md cursor-pointer active:scale-95" : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-800 cursor-pointer active:scale-95"}`}>
                          <Icon size={13} className={selectedTier === t && hasData ? cl : "text-zinc-600"} />
                          <span className="text-[11px] font-black mt-1">{l}</span>
                          <span className="text-[9px] text-zinc-400 font-mono mt-0.5">{hasData ? `${(mojoVal / 1e12).toFixed(6)} XCH` : "Загрузка..."}</span>

                          {/* Юзер видит красивые и понятные минуты */}
                          <span className="text-[8px] text-zinc-500 font-medium mt-0.5">{hasData ? `~${minsVal} мин` : "--"}</span>
                        </button>
                      )
                    })}

                  </div>
                  <span className="block text-[10px] text-zinc-400 font-bold pl-0.5">≈ {getFeeInXchString()} ({parseInt(customFeeMojo).toLocaleString()} Mojo)</span>
                  <span className="block text-[9px] text-zinc-500 leading-normal pl-0.5 select-none">ℹ️ Скорость обработки транзакции зависит от размера комиссии.</span></div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl space-y-3 text-sm max-h-[42vh] overflow-y-auto scrollbar-thin">
                  <div className="flex items-start gap-2 text-amber-400 bg-amber-500/10 p-2.5 rounded-lg text-xs border border-amber-500/20"><AlertCircle size={14} className="shrink-0 mt-0.5" /><span>Пожалуйста, внимательно проверьте данные транзакции перед вводом ПИН-кода.</span></div>
                  <div className="border-t border-zinc-900 pt-2 space-y-2 text-xs">
                    <div className="flex justify-between items-center"><span className="text-zinc-400 font-bold">Всего к списанию:</span><span className="font-black text-white text-sm bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{getTotalOutflowString()}</span></div>
                    {audit && (
                      <>
                        <div className="flex justify-between items-center border-t border-zinc-900 pt-2"><span>Будет отправлено получателю:</span><span className="font-bold text-emerald-400 font-mono">{`${(Number(audit.disposition.target.amount_mojo) / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`}</span></div>
                        <div className="flex justify-between items-center text-zinc-500"><span>Сетевая комиссия (майнерам):</span><span className="font-mono text-zinc-400">{`- ${getFeeInXchString()}`}</span></div>
                        {audit.summary.is_dust_fee_collected && (
                          <div className="flex justify-between items-center text-zinc-500"><span>Пылевая комиссия кошелька:</span><span className="font-mono text-zinc-400">{`- ${(Number(audit.disposition.dust_fee.amount_mojo) / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`}</span></div>
                        )}
                      </>
                    )}
                    <div className="flex flex-col gap-1 pt-2 border-t border-zinc-900 text-xs"><span>Адрес получателя:</span><div className="relative w-full bg-zinc-900/50 p-4 pt-6 rounded-xl border border-zinc-850 flex items-center justify-center text-center select-none min-h-[72px]">{renderHighlightedAddress(targetAddress)}</div></div>
                  </div>
                </div>
                <div><label className="block text-xs font-semibold text-zinc-400 mb-1.5">Введите ПИН-код кошелька</label>
                  <input type="password" maxLength={6} placeholder="••••••" value={pin} onChange={(e) => setPin(e.target.value)} disabled={loading} autoFocus className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-center tracking-widest focus:outline-none focus:border-[#FF2E93] text-white" required /></div>
              </>
            )}
            {statusMessage && <div className="text-xs text-center font-medium bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300 max-h-20 overflow-y-auto whitespace-pre-wrap scrollbar-thin">{statusMessage}</div>}
            {step === 1 ? (
              <Button type="submit" disabled={loading || !targetAddress || !amount || !dynamicFees} className="w-full h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">{loading ? <Loader2 size={14} className="animate-spin text-black" /> : "Проверить монеты и собрать контракт"}</Button>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={loading} onClick={() => setStep(1)} className="w-1/3 h-12 rounded-xl text-xs font-bold cursor-pointer border-zinc-800 text-zinc-300">Назад</Button>
                <Button type="submit" disabled={loading || !pin} className="w-2/3 h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">{loading ? <Loader2 size={14} className="animate-spin text-black" /> : "Подписать и отправить"}</Button>
              </div>
            )}
          </form>
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div className="w-full md:w-1/2 flex flex-col self-stretch">
          <div className="pb-2"><h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">🪙 UTXO Карта (Локальные адреса)</h4></div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[380px] scrollbar-thin scrollbar-thumb-zinc-800/80 scrollbar-track-transparent">
            {addresses.filter((a: any) => a.mojo > 0 || a.index < 3).map((addr: any) => (
              <UtxoCard key={addr.index} addr={addr} unspentCoins={unspentCoins} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
