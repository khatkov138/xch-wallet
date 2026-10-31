'use client'

import React from "react"
import { Layers } from "lucide-react"

interface PeerInfo {
  ip: string;
  port: number;
  trafficUpMb: string;
  trafficDownMb: string;
}

interface TrafficListProps {
  peersList: PeerInfo[];
}

export function TrafficList({ peersList }: TrafficListProps) {
  return (
    <div className="space-y-2.5">
      {/* Шапка группы элементов */}
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
        <Layers size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Network Bandwidth</span>
      </div>
      
      {/* Карточка-обертка в стиле кошелька */}
      <div className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] p-2 overflow-hidden">
        <div className="max-h-[140px] overflow-y-auto pr-1 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800">
          
          {peersList.slice(0, 5).map((peer, idx) => (
            <div 
              key={idx} 
              className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 rounded-xl transition-colors cursor-pointer text-[11px] active:scale-[0.99]"
            >
              {/* Левая часть: IP адрес в стандартном чистом шрифте, БЕЗ font-mono */}
              <span className="text-zinc-300 font-bold tracking-tight truncate max-w-[140px]">
                {peer.ip}
              </span>
              
              {/* 🎯 ИСПРАВЛЕНО: Заменили font-black на font-bold, теперь цифры не слишком жирные */}
              <div className="flex items-center gap-3 text-right font-bold tracking-tight text-xs">
                <span className="text-emerald-400">
                  ↓{parseFloat(peer.trafficDownMb).toFixed(2)}MB
                </span>
                <span className="text-purple-400">
                  ↑{parseFloat(peer.trafficUpMb).toFixed(2)}MB
                </span>
              </div>
            </div>
          ))}

          {/* Пустой список */}
          {peersList.length === 0 && (
            <div className="p-4 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              No active peers discovered
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
