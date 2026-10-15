'use client'

import React, { useState } from "react"
import { Copy, Check, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface AddressCardProps {
  walletAddress: string
}

export function AddressCard({ walletAddress }: AddressCardProps) {
  const [copied, setCopied] = useState(false)

  // Проверяем, загрузился ли реальный адрес из крипто-движка
  const isLoaded = walletAddress && walletAddress !== "Загрузка..." && walletAddress.trim() !== ""

  const copyAddress = () => {
    if (!isLoaded) return
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="bg-zinc-900/30 border border-zinc-900 shadow-xl backdrop-blur-xl rounded-[24px]">
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-0.5">
            Ваш адрес Chia
          </span>
          <button 
            onClick={copyAddress}
            disabled={!isLoaded}
            className={`flex items-center gap-1 text-[10px] font-bold bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-850 transition-all ${
              isLoaded 
                ? "text-zinc-400 hover:text-white cursor-pointer active:scale-95" 
                : "text-zinc-600 border-zinc-900 cursor-not-allowed opacity-50"
            }`}
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? "Скопирован" : "Копировать"}</span>
          </button>
        </div>
        
        <div className="bg-zinc-950/50 border border-zinc-900 p-3 rounded-xl font-mono text-[11px] text-zinc-300 break-all select-all leading-normal tracking-tight min-h-[42px] flex items-center justify-center">
          {isLoaded ? (
            // Если адрес успешно деривирован — выводим xch1...
            <span className="w-full text-left">{walletAddress}</span>
          ) : (
            // Премиальный финтех-лоадер вместо пустой строки, как на скриншоте
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider animate-pulse">
              <Loader2 size={12} className="animate-spin text-[#FF2E93]" />
              <span>Генерация ключей...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
