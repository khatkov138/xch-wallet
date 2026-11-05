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
        {/* Добавлены кастомные стили для тонкого скроллбара прямо через Tailwind */}
        <div className="max-h-[140px] overflow-y-auto pr-1 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800/60 scrollbar-track-transparent">
          
          {peersList.slice(0, 5).map((peer, idx) => {
            // Безопасный парсинг с защитой от undefined/NaN
            const downMb = parseFloat(peer.trafficDownMb || "0")
            const upMb = parseFloat(peer.trafficUpMb || "0")

            // Умный триггер активности: если трафик > 0, пир считается активным
            const isDownloading = downMb > 0.01
            const isUploading = upMb > 0.01

            return (
              <div 
                key={idx} 
                className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 border border-transparent hover:border-zinc-900/20 rounded-xl transition-all cursor-pointer text-[11px] active:scale-[0.99] group"
              >
                {/* Левая часть: Статус-диод + IP адрес */}
                <div className="flex items-center gap-2 truncate max-w-[140px]">
                  {/* Живой сетевой диод */}
                  <span className={`h-1.5 w-1.5 rounded-full border transition-all duration-300 ${
                    isDownloading || isUploading 
                      ? "bg-emerald-400 border-emerald-500/30 shadow-[0_0_6px_rgba(52,211,153,0.4)] animate-pulse" 
                      : "bg-zinc-700 border-zinc-800"
                  }`} />
                  
                  <span className="text-zinc-300 font-bold tracking-tight truncate group-hover:text-zinc-100 transition-colors">
                    {peer.ip}
                  </span>
                </div>
                
                {/* Правая часть: Скорости с микро-диодами активности направления */}
                <div className="flex items-center gap-4 text-right font-bold tracking-tight text-xs">
                  {/* Скачивание (Входящий) */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-mono">
                      ↓{downMb.toFixed(2)}<span className="text-[9px] text-emerald-500/80 font-bold ml-0.5">MB</span>
                    </span>
                  </div>

                  {/* Отдача (Исходящий) */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-mono">
                      ↑{upMb.toFixed(2)}<span className="text-[9px] text-purple-500/80 font-bold ml-0.5">MB</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Пустой список (Заглушка) */}
          {peersList.length === 0 && (
            <div className="py-8 flex flex-col items-center justify-center gap-1.5 text-center">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-800 border border-zinc-900" />
              <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                No active peers discovered
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
