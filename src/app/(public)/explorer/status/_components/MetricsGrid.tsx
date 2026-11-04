'use client'

import React from "react"
import { Layers } from "lucide-react"
import { DerivedNodeStatus } from "@/hooks/useWalletStatus"

interface MetricsGridProps {
  nodeData?: DerivedNodeStatus | null; // Делаем опциональным, чтобы не ломать обратную совместимость
  blocksPerMinute: number;
  totalPeers: number;
}

export function MetricsGrid({ nodeData, blocksPerMinute, totalPeers }: MetricsGridProps) {
  // Если у нас в будущем появятся реальные пиры из `nodeData`, хук сможет их забрать отсюда, 
  // а пока используем переданный `totalPeers` (или 0)
  const displayPeers = totalPeers;

  return (
    <div className="space-y-2.5">
      {/* 🎯 Шапка группы элементов один в один как над "Последняя активность" */}
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
        <Layers size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Node Performance</span>
      </div>

      {/* 🎯 Сетка метрик в твоем фирменном стиле карточек */}
      <div className="grid grid-cols-2 gap-3">
        
        {/* Карточка 1: Скорость обработки блоков */}
        <div className="p-3.5 bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] flex flex-col justify-between h-[68px]">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            <span className="h-1 w-1 rounded-full bg-cyan-400 animate-pulse" />
            <span>Node Speed</span>
          </div>
          {/* 🎯 ИСПРАВЛЕНО: Чистый font-sans без перечеркнутых нулей, жирный font-black */}
          <div className="text-sm font-black text-zinc-200 tracking-tight leading-none">
            +{blocksPerMinute} <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">bpm</span>
          </div>
        </div>

        {/* Карточка 2: Количество активных подключений */}
        <div className="p-3.5 bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] flex flex-col justify-between h-[68px]">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            <span className="h-1 w-1 rounded-full bg-purple-400 animate-pulse" />
            <span>Connections</span>
          </div>
          {/* 🎯 ИСПРАВЛЕНО: Гладкий, плотный шрифт цифр, как в суммах XCH */}
          <div className="text-sm font-black text-zinc-200 tracking-tight leading-none">
            {displayPeers} <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">peers</span>
          </div>
        </div>

      </div>
    </div>
  )
}
