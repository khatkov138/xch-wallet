'use client'

import React from "react"
import { ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ActionButtonsProps {
  onReceiveClick: () => void
}

export function ActionButtons({ onReceiveClick }: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button 
        onClick={onReceiveClick}
        // Заменил текст на text-zinc-100 (белый), чтобы он не сливался с темным фоном
        className="h-12 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all text-zinc-100"
      >
        <ArrowDownLeft size={14} className="text-emerald-400 shrink-0" />
        <span>Получить</span>
      </Button>

      <Button 
        className="h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
      >
        <ArrowUpRight size={14} className="text-[#FF2E93] shrink-0" />
        <span>Отправить</span>
      </Button>
    </div>
  )
}
