'use client'

import React, { useState, useEffect } from "react"
import { useSendTransaction } from "@/hooks/useSendTransaction"
import { Button } from "@/components/ui/button"
import { Loader2, X, AlertCircle } from "lucide-react"
import { renderHighlightedAddress } from "@/lib/utils/ui"

interface SendModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SendModal({ isOpen, onClose }: SendModalProps) {
  const [targetAddress, setTargetAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [customFeeMojo, setCustomFeeMojo] = useState("5000000")
  const [pin, setPin] = useState("")

  const {
    step,
    setStep,
    loading,
    statusMessage,
    handleSubmit,
    resetHooksState
  } = useSendTransaction({
    targetAddress,
    amount,
    customFeeMojo,
    pin,
    setPin,
    onClose
  })

  useEffect(() => {
    if (!isOpen) {
      setTargetAddress("")
      setAmount("")
      setCustomFeeMojo("5000000")
      resetHooksState()
    }
  }, [isOpen])

  if (!isOpen) return null

  const getFeeInXchString = () => {
    const mojo = parseFloat(customFeeMojo) || 0
    return mojo === 0 ? "0 XCH" : `${(mojo / 1_000_000_000_000).toFixed(12).replace(/\.?0+$/, "")} XCH`
  }

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
                <input type="number" value={customFeeMojo} onChange={(e) => setCustomFeeMojo(e.target.value)} disabled={loading} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50 font-mono" />
                <span className="block text-[10px] text-zinc-500 font-medium mt-1.5 pl-1">≈ {getFeeInXchString()} (1 XCH = 1 000 000 000 000 Mojo)</span>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl space-y-3 text-sm">
                <div className="flex items-start gap-2 text-amber-400 bg-amber-500/10 p-2.5 rounded-lg text-xs font-medium border border-amber-500/20"><AlertCircle size={14} className="shrink-0 mt-0.5" /><span>Пожалуйста, внимательно проверьте данные. После ввода ПИН-кода монеты будут отправлены в сеть.</span></div>
                <div className="border-t border-zinc-900 pt-2 space-y-1 text-xs">
                  <div className="flex justify-between items-center text-xs"><span className="text-zinc-500 font-medium">Вы отправляете:</span><span className="font-bold text-white text-sm">{amount} XCH</span></div>
                  <div className="flex justify-between items-center text-xs"><span className="text-zinc-500 font-medium">Сетевая комиссия:</span><span className="font-mono text-zinc-300">{getFeeInXchString()}</span></div>
                  <div className="flex flex-col gap-1 pt-2 border-t border-zinc-900 text-xs">
                    <span className="text-zinc-500 font-medium mb-1">Адрес получателя:</span>
                    <div className="relative w-full bg-zinc-900/50 hover:bg-zinc-850/60 p-4 pt-6 rounded-xl border border-zinc-850 flex items-center justify-center group transition-all text-left cursor-pointer active:scale-[0.99] min-h-[72px] select-none [user-select:none] [-webkit-user-select:none]">
                      <div className="w-full flex justify-center text-center select-none [user-select:none]">{renderHighlightedAddress(targetAddress)}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Введите ПИН-код кошелька</label>
                <input type="password" maxLength={6} placeholder="••••••" value={pin} onChange={(e) => setPin(e.target.value)} disabled={loading} autoFocus className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-center tracking-widest focus:outline-none focus:border-[#FF2E93] transition-colors disabled:opacity-50" required />
              </div>
            </>
          )}
          {statusMessage && <div className="text-xs text-center font-medium bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300 max-h-24 overflow-y-auto whitespace-pre-wrap">{statusMessage}</div>}
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
