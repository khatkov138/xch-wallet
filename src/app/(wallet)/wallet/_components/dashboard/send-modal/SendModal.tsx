'use client'

import React from "react"
import { X } from "lucide-react"
import { SendModalProvider, useSendModalContext } from "./SendModalContext"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"

import { UtxoCard } from "./UtxoCard"
import { SendStep3 } from "./steps/SendStep3"
import { SendStep1 } from "./steps/SendStep1"
import { SendStep2 } from "./steps/SendStep2"

interface SendModalProps { 
  isOpen: boolean 
  onClose: () => void 
}

function SendModalContent() {
  // Читаем централизованную функцию безопасного закрытия из контекста
  const { step, statusMessage, onCloseForm } = useSendModalContext()
  const { unspentCoins, addresses } = useWalletDashboard()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl text-white shadow-2xl flex flex-col md:flex-row items-start p-6 gap-6 max-h-[95vh] overflow-hidden">
        
        {/* КРЕСТИК ВЕРХНЕЙ ПАНЕЛИ */}
        <button 
          type="button" 
          onClick={onCloseForm} 
          className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* ЛЕВАЯ КОЛОНКА (УПРАВЛЕНИЕ ЭКРАНАМИ ШАГОВ) */}
        <div className="w-full md:w-1/2 shrink-0">
          {step === 3 ? (
            <SendStep3 />
          ) : step === 1 ? (
            <SendStep1 />
          ) : (
            <SendStep2/>
          )}

          {/* Информационный лог ошибок скрывается строго по значению шага */}
          {statusMessage && step !== 3 && (
            <div className="mt-4 text-xs text-center font-mono bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-zinc-300 max-h-20 overflow-y-auto whitespace-pre-wrap scrollbar-thin">
              {statusMessage}
            </div>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА (КАРТА UTXO ЛОКАЛЬНЫХ АДРЕСОВ) */}
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
      <SendModalContent />
    </SendModalProvider>
  )
}
