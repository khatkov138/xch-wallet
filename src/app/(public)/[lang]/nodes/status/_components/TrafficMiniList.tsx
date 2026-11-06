'use client'

import React from "react"
import { Layers, ArrowDown, ArrowUp } from "lucide-react"

interface PeerInfo {
  ip: string
  port: number
  trafficUpMb: string
  trafficDownMb: string
}

interface TrafficMiniListProps {
  peers: PeerInfo[]
}

// 🔐 Высокоточная утилита маскирования IP под строгий моноширинный формат
function maskIp(ip: string): string {
  if (!ip) return "****"
  const parts = ip.split('.')
  
  // Маскируем 2 и 3 октеты в единый сплошной блок звездочек для идеальной длины
  if (parts.length === 4) {
    return `${parts[0]}.****.${parts[3]}`
  }
  
  if (ip.length > 8) {
    return `${ip.substring(0, 3)}****${ip.substring(ip.length - 3)}`
  }
  return ip
}

export function TrafficMiniList({ peers }: TrafficMiniListProps) {
  return (
    <div className="space-y-1.5 w-full">
      {/* ЗАГОЛОВОК БЛОКА BANDWIDTH */}
      <div className="flex items-center justify-between px-0.5 text-zinc-600 font-bold uppercase tracking-wider text-[7px] select-none">
        <div className="flex items-center gap-1">
          <Layers size={9} /> Bandwidth (Транзит пиров)
        </div>
        <div className="text-zinc-550 font-mono font-black uppercase text-[7px]">
          Активно: <span className="text-zinc-300">{peers.length} узлов</span>
        </div>
      </div>
      
      {/* КОНТЕЙНЕР СПИСКА ПИРОВ */}
      <div className="bg-zinc-950/60 border border-zinc-900/60 rounded-2xl p-1 max-h-[82px] overflow-y-auto pr-1 space-y-0.5 font-mono scrollbar-none">
        {peers.slice(0, 3).map((peer, idx) => (
          <div key={idx} className="flex items-center justify-between p-1.5 hover:bg-zinc-900/40 rounded-xl text-[8px] font-medium tracking-tight">
            
            {/* 🚀 ИЗМЕНЕНО: Строгий текстовый префикс "IP:" вместо иконки геолокации и чистые компактные звездочки */}
            <span className="text-zinc-400 truncate max-w-[100px] font-bold select-all tracking-normal" title="IP-адрес узла скрыт шифрованием">
              <span className="text-zinc-650 font-mono mr-0.5 uppercase">IP:</span> {maskIp(peer.ip)}
            </span>
            
            {/* ТРАФИК ПИРА */}
            <div className="flex items-center gap-3 font-bold text-zinc-300 select-none">
              <span className="flex items-center text-emerald-400">
                <ArrowDown size={8} strokeWidth={3} className="mr-0.5" />
                {parseFloat(peer.trafficDownMb || "0").toFixed(1)}M
              </span>
              <span className="flex items-center text-zinc-400">
                <ArrowUp size={8} strokeWidth={3} className="mr-0.5 text-zinc-500" />
                {parseFloat(peer.trafficUpMb || "0").toFixed(1)}M
              </span>
            </div>

          </div>
        ))}
        {peers.length === 0 && (
          <p className="text-zinc-600 text-center font-bold py-2 uppercase tracking-widest text-[7px] select-none">
            Поиск подключений...
          </p>
        )}
      </div>
    </div>
  )
}
