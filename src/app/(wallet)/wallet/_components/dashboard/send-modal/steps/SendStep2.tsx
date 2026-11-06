'use client'

import React, { useRef } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSendModalContext } from "../SendModalContext"
import { useSendTxMutation } from "../mutations/useSendTxMutation"
import { TransactionReviewCard } from "../TransactionReviewCard"

export function SendStep2() {
  const {
    pin,
    setPin,
    setStep
  } = useSendModalContext()

  // Инициализируем изолированную мутацию шага 2
  const sentTransactionsRef = useRef<Set<string>>(new Set())
  const sendTxMutation = useSendTxMutation(sentTransactionsRef)
  
  const isPending = sendTxMutation.isPending

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isPending || !pin || pin.length !== 6) return

    // 🎯 Мутация сама заберет всё из контекста под капотом (включая pin)
    sendTxMutation.mutate()
  }

  return (
    <form onSubmit={handleLocalSubmit} className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-start gap-2 text-amber-400 bg-amber-500/5 p-3 rounded-xl text-xs border border-amber-500/10">
        <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
        <span className="leading-relaxed">Пожалуйста, проверьте сумму и адрес получателя перед подтверждением.</span>
      </div>
      
      {/* 🎯 НАШ ЕДИНЫЙ ШАБЛОН КАРТОЧКИ: Подтянет данные аудита из контекста и покажет "Комиссия XChia Wallet" */}
      <TransactionReviewCard />
      
      {/* Ввод ПИН-кода */}
      <div className="pt-1">
        <label className="block text-xs font-medium text-zinc-400 mb-1.5 pl-0.5">Код безопасности (ПИН)</label>
        <input 
          type="password" 
          maxLength={6} 
          placeholder="••••••" 
          value={pin} 
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            setPin(val);
          }} 
          disabled={isPending} 
          autoFocus 
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-center tracking-widest focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 text-white disabled:opacity-55 transition-all font-mono" 
          required 
        />
      </div>

      {/* Экшены */}
      <div className="flex gap-2 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          disabled={isPending} 
          onClick={() => setStep(1)} 
          className="w-1/3 h-12 rounded-xl text-xs font-bold cursor-pointer border-zinc-800 text-zinc-300"
        >
          Назад
        </Button>
        
        <Button 
          type="submit" 
          disabled={isPending || pin.length !== 6} 
          className="w-2/3 h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin text-black" />
          ) : (
            "Подписать и отправить"
          )}
        </Button>
      </div>
    </form>
  )
}
