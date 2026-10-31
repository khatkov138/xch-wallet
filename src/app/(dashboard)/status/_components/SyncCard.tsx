'use client'

import React from "react"
import { Layers } from "lucide-react"

interface SyncCardProps {
  network: string;
  isSynced: boolean;
  isSyncingMode: boolean;
  currentHeight: number;
  targetHeight: number;
  progressPercent: string;
  estimatedTimeLeft: string;
}

export function SyncCard({
  network,
  isSynced,
  currentHeight,
  targetHeight,
  progressPercent,
  estimatedTimeLeft
}: SyncCardProps) {
  
  // Цветовая схема: Изумрудный для Synced, Янтарный для In Progress
  const badgeClass = isSynced 
    ? "text-emerald-400 bg-emerald-500/15" 
    : "text-amber-400 bg-amber-500/15 animate-pulse"

  const progressBgClass = isSynced
    ? "bg-emerald-500"
    : "bg-amber-500"

  // Проверка на фейковые 100% при инициализации
  const isInitializing = !isSynced && (currentHeight === targetHeight || progressPercent === "100.0000")
  const displayPercent = isInitializing ? "0.0000" : progressPercent

  return (
    <div className="space-y-2.5">
      {/* 🎯 Шапка группы элементов точь-в-точь как над "Последняя активность" */}
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
        <Layers size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Node NodeState</span>
      </div>

      {/* 🎯 Корневой блок в стиле твоих Card */}
      <div className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] p-4 space-y-3.5">
        
        {/* Строка заголовков и бейджей */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-white">Blockchain</p>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800/40">
              {network}
            </span>
          </div>

        
        </div>

        {/* Блок прогресс-бара и высот */}
        <div className="space-y-2 bg-zinc-900/10 p-3 border border-zinc-900/40 rounded-xl">
          
          <div className="flex justify-between items-baseline px-0.5">
            <span className="text-xl font-mono font-black text-zinc-100 tracking-tight">
              {currentHeight.toLocaleString()}
            </span>
            <span className="text-[10px] font-mono font-bold text-zinc-500">
              of {targetHeight.toLocaleString()} bl.
            </span>
          </div>
          
          {/* Тонкая линия прогресса кошелька */}
          <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${progressBgClass}`}
              style={{ width: `${Math.min(parseFloat(displayPercent), 100)}%` }}
            />
          </div>

          {/* Нижняя информационная строчка */}
          <div className="flex justify-between items-center text-[10px] font-mono pt-0.5 px-0.5">
            <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wide">
              {!isSynced ? (isInitializing ? "Connecting..." : `ETA: ${estimatedTimeLeft}`) : "Blockchain is live"}
            </span>
            <span className="text-zinc-400 font-bold">
              {displayPercent}%
            </span>
          </div>

        </div>

      </div>
    </div>
  )
}
