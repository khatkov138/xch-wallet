'use client'
import React, { useState, useEffect } from "react"
import { useSendTransaction } from "@/hooks/useSendTransaction"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { Button } from "@/components/ui/button"
import { Loader2, X, AlertCircle } from "lucide-react"
import { renderHighlightedAddress } from "@/lib/utils/ui"
import { UtxoCard } from "./UtxoCard"
import { usePuzzleHashToAddress } from "@/hooks/usePuzzleHashToAddress"

interface SendModalProps { isOpen: boolean; onClose: () => void }
const SERVICE_FEE_XCH_STR = "0.0001 XCH"

export function SendModal({ isOpen, onClose }: SendModalProps) {
  const [targetAddress, setTargetAddress] = useState(""), [amount, setAmount] = useState("")
  const [customFeeMojo, setCustomFeeMojo] = useState("500000000"), [pin, setPin] = useState("")
  const { unspentCoins, addresses } = useWalletDashboard()
  const { step, setStep, loading, statusMessage, handleSubmit, resetHooksState, preparedSpendData } = useSendTransaction({
    targetAddress, amount, customFeeMojo, pin, setPin, onClose, unspentCoins, walletAddresses: addresses
  })

  useEffect(() => { if (!isOpen) { setTargetAddress(""); setAmount(""); setCustomFeeMojo("500000000"); resetHooksState() } }, [isOpen])

  // 🎯 ЖЕЛЕЗНЫЙ ФИКС ПОРЯДКА ХУКОВ: Все вызовы идут строго до раннего возврата if (!isOpen)
  const audit = preparedSpendData?.audit_info
  const changeAddress = usePuzzleHashToAddress(audit?.disposition.standard_change.puzzle_hash)
  const shortChangeAddr = changeAddress ? `${changeAddress.slice(0, 7)}...${changeAddress.slice(-6)}` : "..."

  const dustFeeAddress = usePuzzleHashToAddress(audit?.disposition.dust_fee.puzzle_hash)
  const shortDustFeeAddr = dustFeeAddress ? `${dustFeeAddress.slice(0, 7)}...${dustFeeAddress.slice(-6)}` : "..."

  if (!isOpen) return null

  const getFeeInXchString = () => {
    const mojo = parseFloat(customFeeMojo) || 0
    return mojo === 0 ? "0 XCH" : `${(mojo / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`
  }
  
  const getTotalOutflowString = () => {
    const sendAmt = parseFloat(amount) || 0
    return `${sendAmt.toFixed(4)} XCH`
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* 🎯 РОДИТЕЛЬСКИЙ ФИКС: items-start не дает правой панели распирать модалку вниз */}
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl text-white shadow-2xl flex flex-col md:flex-row items-start p-6 gap-6 max-h-[95vh] overflow-hidden">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer transition-colors z-10"><X size={18} /></button>
        
        {/* ЛЕВАЯ КОЛОНКА (ГЛАВНАЯ) */}
        <div className="w-full md:w-1/2 shrink-0">
          <h3 className="text-lg font-bold mb-4 tracking-tight">Отправить XCH</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <div><label className="block text-xs font-semibold text-zinc-400 mb-1.5">Адрес получателя</label>
                  <input type="text" placeholder="xch1..." value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] text-white" required /></div>
                <div><label className="block text-xs font-semibold text-zinc-400 mb-1.5">Сумма (XCH)</label>
                  <input type="number" step="0.000000000001" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] text-white" required /></div>
                <div><label className="block text-xs font-semibold text-zinc-400 mb-1.5">Сетевая комиссия (Mojo)</label>
                  <input type="number" value={customFeeMojo} onChange={(e) => setCustomFeeMojo(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] font-mono text-white" />
                  <span className="block text-[10px] text-zinc-500 font-medium mt-1.5 pl-1">≈ {getFeeInXchString()} (1 XCH = 10¹² Mojo)</span></div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl space-y-3 text-sm max-h-[42vh] overflow-y-auto scrollbar-thin">
                  <div className="flex items-start gap-2 text-amber-400 bg-amber-500/10 p-2.5 rounded-lg text-xs border border-amber-500/20"><AlertCircle size={14} className="shrink-0 mt-0.5" /><span>Пожалуйста, внимательно проверьте данные транзакции перед вводом ПИН-кода.</span></div>
                  <div className="border-t border-zinc-900 pt-2 space-y-2 text-xs">
                    
                    {/* 1. СУММА К СПИСАНИЮ */}
                    <div className="flex justify-between items-center"><span className="text-zinc-400 font-bold">Всего к списанию:</span><span className="font-black text-white text-sm bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{getTotalOutflowString()}</span></div>
                    
                    {/* ЦЕПОЧКА АУДИТА */}
                                       {/* ЦЕПОЧКА АУДИТА */}
                                      {/* ЦЕПОЧКА АУДИТА */}
                    {audit && (
                      <>
                        {/* 2. БУДЕТ ОТПРАВЛЕНО */}
                        <div className="flex justify-between items-center border-t border-zinc-900 pt-2">
                          <span>Будет отправлено получателю:</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {`${(Number(audit.disposition.target.amount_mojo) / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`}
                          </span>
                        </div>
                        
                        {/* 3. СЕТЕВАЯ КОМИССИЯ (🎯 ТЕПЕРЬ С МИНУСОМ) */}
                        <div className="flex justify-between items-center text-zinc-500">
                          <span>Сетевая комиссия (майнерам):</span>
                          <span className="font-mono text-zinc-400">{`- ${getFeeInXchString()}`}</span>
                        </div>
                        
                        {/* 4. ПЫЛЕВАЯ КОМИССИЯ (🎯 ТОЖЕ С МИНУСОМ И СЕРАЯ) */}
                        {audit.summary.is_dust_fee_collected && (
                          <div className="flex justify-between items-center text-zinc-500">
                            <span>Пылевая комиссия кошелька:</span>
                            <span className="font-mono text-zinc-400">
                              {`- ${(Number(audit.disposition.dust_fee.amount_mojo) / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`}
                            </span>
                          </div>
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
              <Button type="submit" disabled={loading || !targetAddress || !amount} className="w-full h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">{loading ? <Loader2 size={14} className="animate-spin text-black" /> : "Проверить монеты и собрать контракт"}</Button>
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
