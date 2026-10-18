'use client'

import React, { useState } from "react"
import { Copy, Check, Loader2 } from "lucide-react"

interface AddressCardProps {
  // ФИКС ТИПИЗАЦИИ: Переименовали пропс в address, чтобы он идеально состыковался с вызовом в page.tsx
  address: string
}

export function AddressCard({ address }: AddressCardProps) {
  const [copied, setCopied] = useState(false)

  // Проверяем, загрузился ли реальный адрес из крипто-движка Zustand
  const isLoaded = address && address !== "Загрузка..." && address.trim() !== ""

  const copyAddress = async () => {
    if (!isLoaded) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Не удалось скопировать адрес в буфер:", err)
    }
  }

  return (
    // Оставляем твой премиальный темный бэкдроп-дизайн
    <div className="bg-zinc-900/30 border border-zinc-900 shadow-xl backdrop-blur-xl rounded-[24px] p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-0.5">
          Ваш адрес Chia
        </span>
        <button 
          onClick={copyAddress}
          disabled={!isLoaded}
          className={`flex items-center gap-1 text-[10px] font-bold bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-850/60 transition-all ${
            isLoaded 
              ? "text-zinc-400 hover:text-white cursor-pointer active:scale-95" 
              : "text-zinc-600 border-zinc-900/40 cursor-not-allowed opacity-50"
          }`}
        >
          {copied ? <Check size={11} className="text-emerald-400 animate-in fade-in zoom-in-75 duration-200" /> : <Copy size={11} />}
          <span>{copied ? "Скопирован" : "Копировать"}</span>
        </button>
      </div>
      
      <div className="bg-zinc-950/50 border border-zinc-900 p-3 rounded-xl font-mono text-[11px] text-zinc-300 break-all select-all leading-normal tracking-tight min-h-[42px] flex items-center justify-center">
        {isLoaded ? (
          // Если адрес успешно деривирован — выводим txch1... / xch1...
          <span className="w-full text-left font-semibold tracking-wider text-zinc-200">{address}</span>
        ) : (
          // Твой каноничный премиальный финтех-лоадер на время ввода ПИН-кода и деривации
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider animate-pulse">
            <Loader2 size={12} className="animate-spin text-[#FF2E93]" />
            <span>Генерация ключей...</span>
          </div>
        )}
      </div>
    </div>
  )
}
