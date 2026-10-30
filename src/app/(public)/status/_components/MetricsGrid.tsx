'use client'

import React from "react"
import { Activity, Cpu } from "lucide-react"

interface MetricsGridProps {
  blocksPerMinute: number;
  totalPeers: number;
}

export function MetricsGrid({ blocksPerMinute, totalPeers }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Исправлено: теперь метрика бл/мин привязана к скорости обработки блоков нодой */}
      <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/80 space-y-0.5">
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>Скорость ноды</span>
        </div>
        <div className="text-sm font-mono font-black text-zinc-200">
          +{blocksPerMinute} <span className="text-[10px] text-zinc-500 font-sans font-medium">бл/мин</span>
        </div>
      </div>

      {/* Количество активных сетевых нод */}
      <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/80 space-y-0.5">
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
          <Cpu className="w-3 h-3 text-purple-400" />
          <span>Подключения</span>
        </div>
        <div className="text-sm font-mono font-black text-zinc-200">
          {totalPeers} <span className="text-[10px] text-zinc-500 font-sans font-medium">пиров</span>
        </div>
      </div>
    </div>
  )
}
