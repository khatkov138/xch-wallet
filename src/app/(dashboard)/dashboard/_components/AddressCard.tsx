'use client'

import React, { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface AddressCardProps {
  walletAddress: string
}

export function AddressCard({ walletAddress }: AddressCardProps) {
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="bg-zinc-900/30 border border-zinc-900 shadow-xl backdrop-blur-xl rounded-[24px]">
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-0.5">Ваш адрес Chia</span>
          <button 
            onClick={copyAddress}
            className="text-zinc-400 hover:text-white flex items-center gap-1 text-[10px] font-bold bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-850 transition-all cursor-pointer"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? "Скопирован" : "Копировать"}</span>
          </button>
        </div>
        <div className="bg-zinc-950/50 border border-zinc-900 p-3 rounded-xl font-mono text-[11px] text-zinc-300 break-all select-all leading-normal tracking-tight">
          {walletAddress}
        </div>
      </CardContent>
    </Card>
  )
}
