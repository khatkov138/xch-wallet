'use client'

import React from "react"

interface SyncCardProps {
  isSynced: boolean;
  isSyncingMode: boolean;
  currentHeight: number;
  targetHeight: number;
  progressPercent: string;
  estimatedTimeLeft: string;
}

export function SyncCard({
  isSynced,
  isSyncingMode,
  currentHeight,
  targetHeight,
  progressPercent,
  estimatedTimeLeft
}: SyncCardProps) {
  return (
    <div className={`p-4 rounded-2xl border transition-all duration-300 bg-zinc-900/40 ${
      isSynced ? "border-emerald-500/10" : "border-[#FF2E93]/10"
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Синхронизация</span>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
          isSynced 
            ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20" 
            : "text-[#FF2E93] bg-[#FF2E93]/5 border-[#FF2E93]/20 animate-pulse"
        }`}>
          {isSynced ? "Полная" : "В процессе"}
        </span>
      </div>
      
      <div className="mt-3 space-y-1">
        <div className="flex justify-between items-baseline">
          <span className="text-xl font-mono font-black text-zinc-100 tracking-tight">
            {currentHeight.toLocaleString()}
          </span>
          <span className="text-[10px] font-mono font-bold text-zinc-500">
            из {targetHeight.toLocaleString()} бл.
          </span>
        </div>
        
        {/* Градиентный Прогресс-бар в стиле XCHA */}
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#FF2E93] to-purple-500 transition-all duration-500"
            style={{ width: `${Math.min(parseFloat(progressPercent), 100)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono pt-0.5">
          {/* Улучшено: показываем таймер всегда, пока идет синхронизация */}
          <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wide">
            {!isSynced ? `Осталось: ${estimatedTimeLeft}` : ""}
          </span>
          <span className="text-zinc-400 font-bold">
            {progressPercent}%
          </span>
        </div>
      </div>
    </div>
  )
}
