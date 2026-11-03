'use client'

import React from "react"
import { Button } from "@/components/ui/button"
import { Loader2, X } from "lucide-react"
import { SendModalProvider, useSendModalContext } from "./SendModalContext"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { SendStepOne } from "./SendStepOne"
import { SendStepTwo } from "./SendStepTwo"
import { UtxoCard } from "./UtxoCard"

interface SendModalProps { 
  isOpen: boolean 
  onClose: () => void 
}

function SendModalContent({ onClose }: { onClose: () => void }) {
  const { 
    step, 
    setStep, 
    loading, 
    statusMessage, 
    handleSubmit, 
    targetAddress, 
    amount, 
    dynamicFees, 
    pin 
  } = useSendModalContext()

  // Правая колонка реактивно забирает данные дашборда на месте
  const { unspentCoins, addresses } = useWalletDashboard()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl text-white shadow-2xl flex flex-col md:flex-row items-start p-6 gap-6 max-h-[95vh] overflow-hidden">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer transition-colors z-10">
          <X size={18} />
        </button>

        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="w-full md:w-1/2 shrink-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? <SendStepOne /> : <SendStepTwo />}

            {statusMessage && (
              <div className="text-xs text-center font-medium bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300 max-h-20 overflow-y-auto whitespace-pre-wrap scrollbar-thin">
                {statusMessage}
              </div>
            )}
            
            {step === 1 ? (
              <Button type="submit" disabled={loading || !targetAddress || !amount || !dynamicFees} className="w-full h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
                {loading ? <Loader2 size={14} className="animate-spin text-black" /> : "Проверить монеты и собрать контракт"}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={loading} onClick={() => setStep(1)} className="w-1/3 h-12 rounded-xl text-xs font-bold cursor-pointer border-zinc-800 text-zinc-300">
                  Назад
                </Button>
                <Button type="submit" disabled={loading || !pin} className="w-2/3 h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
                  {loading ? <Loader2 size={14} className="animate-spin text-black" /> : "Подписать и отправить"}
                </Button>
              </div>
            )}
          </form>
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div className="w-full md:w-1/2 flex flex-col self-stretch">
          <div className="pb-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">🪙 UTXO Карта (Локальные адреса)</h4>
          </div>
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

export function SendModal({ isOpen, onClose }: SendModalProps) {
  if (!isOpen) return null
  return (
    <SendModalProvider isOpen={isOpen} onClose={onClose}>
      <SendModalContent onClose={onClose} />
    </SendModalProvider>
  )
}
