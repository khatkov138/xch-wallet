'use client'

import React from "react"
import { ArrowDownUp } from "lucide-react"

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
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
        <ArrowDownUp className="w-3 h-3" />
        <span>Потребление трафика</span>
      </div>
      
      <div className="max-h-[140px] overflow-y-auto rounded-xl border border-zinc-800/60 divide-y divide-zinc-800/40 bg-zinc-900/10">
        {peersList.slice(0, 5).map((peer, idx) => (
          <div key={idx} className="p-2.5 flex items-center justify-between text-[11px] font-mono">
            <span className="text-zinc-300 font-medium truncate max-w-[140px]">
              {peer.ip}
            </span>
            <div className="flex items-center gap-3 text-right">
              <span className="text-emerald-500/90">↓{Math.round(parseFloat(peer.trafficDownMb))}MB</span>
              <span className="text-purple-400/90">↑{Math.round(parseFloat(peer.trafficUpMb))}MB</span>
            </div>
          </div>
        ))}
        {peersList.length === 0 && (
          <div className="p-4 text-center text-xs text-zinc-600 uppercase font-bold tracking-wider">
            Узлы сети не обнаружены
          </div>
        )}
      </div>
    </div>
  )
}
