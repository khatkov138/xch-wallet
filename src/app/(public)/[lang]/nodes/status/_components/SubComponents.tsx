'use client'

import React from "react"
import { Layers } from "lucide-react"

export function StatusHeader({ network, isRpcDown, isConnecting }: { network: string; isRpcDown: boolean; isConnecting: boolean }) {
  const statusText = isRpcDown ? "Оффлайн" : isConnecting ? "Подключение..." : "Онлайн"
  const statusColor = isRpcDown ? "text-red-500" : isConnecting ? "text-amber-400" : "text-emerald-400"
  const ledColor = isRpcDown ? "bg-red-500" : "bg-emerald-400"

  return (
    <header className="flex flex-col gap-1 border-b border-zinc-900/60 pb-3 relative z-10 select-none">
      <div className="text-sm font-black text-white font-sans tracking-tight">
        {network === "MAINNET" ? "Mainnet" : "Testnet11"}
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
        <span>Статус ноды:</span>
        <div className="flex items-center gap-1">
          <span className={`h-1 w-1 rounded-full ${ledColor}`} />
          <span className={`font-black ${statusColor}`}>{statusText}</span>
        </div>
      </div>
    </header>
  )
}

export function StatusMetrics({ currentHeight, targetHeight, isSynced, bpm, peers, particles, onStyle }: any) {
  const remain = Math.max(0, targetHeight - currentHeight)
  return (
    <div className="grid grid-cols-2 gap-2 font-bold select-none">
      <div className="bg-zinc-950/40 border border-zinc-900 p-2 rounded-xl flex flex-col justify-between min-h-[44px] relative">
        <p className="text-zinc-550 font-bold uppercase text-[7px] tracking-tight">Текущий блок</p>
        <p className="text-[11px] font-black text-white font-mono mt-0.5 relative flex items-center gap-1">
          #{currentHeight.toLocaleString()}
        </p>
      </div>
      <div className="bg-zinc-950/40 border border-zinc-900 p-2 rounded-xl flex flex-col justify-between min-h-[44px]">
        <p className="text-zinc-550 font-bold uppercase text-[7px] tracking-tight">{isSynced ? "Статус" : "Осталось"}</p>
        <p className={`text-[11px] font-black font-mono mt-0.5 ${isSynced ? "text-emerald-400" : "text-white"}`}>{isSynced ? "100.00%" : remain.toLocaleString()}</p>
      </div>
      <div className="bg-zinc-950/40 border border-zinc-900 p-2 rounded-xl flex flex-col justify-between min-h-[44px]">
        <p className="text-zinc-550 font-bold uppercase text-[7px] tracking-tight">Темп ноды</p>
        <p className="text-[11px] font-black text-zinc-200 font-mono mt-0.5">+{bpm} <span className="text-[8px] text-zinc-500 uppercase font-sans font-bold">bpm</span></p>
      </div>
      <div className="bg-zinc-950/40 border border-zinc-900 p-2 rounded-xl flex flex-col justify-between min-h-[44px]">
        <p className="text-zinc-550 font-bold uppercase text-[7px] tracking-tight">Активные пиры</p>
        <p className="text-[11px] font-black text-zinc-200 font-mono mt-0.5">{peers} <span className="text-[8px] text-zinc-500 uppercase font-sans font-bold">peers</span></p>
      </div>
    </div>
  )
}

export function LiveTicker({ isSynced, isConnecting, cleanPercent, seconds }: { isSynced: boolean; isConnecting: boolean; cleanPercent: string; seconds: number }) {
  return (
    <div className="p-0.5 bg-zinc-950/60 border border-zinc-900 rounded-xl font-mono select-none">
      <div className="flex justify-between p-1.5 bg-zinc-900/20 border border-zinc-900/40 rounded-lg text-white items-center text-[8px] font-bold">
        <div className="flex items-center gap-1.5">
          <span className={`h-1 w-1 rounded-full ${isSynced ? "bg-emerald-400" : "bg-[#FF2E93]"}`} />
          <span className="text-zinc-400 font-sans tracking-tight">
            {isSynced ? "Ядро полностью синхронизировано" : isConnecting ? "Поиск пиров в сети..." : `Синхронизация базы данных: ${cleanPercent}%`}
          </span>
        </div>
        <span className="text-zinc-600 tracking-wider uppercase text-[7px] font-black">{isSynced ? "live" : `${seconds}s`}</span>
      </div>
    </div>
  )
}

export function TrafficMiniList({ peers }: { peers: any[] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 px-0.5 text-zinc-600 font-bold uppercase tracking-wider text-[7px] select-none"><Layers size={9} /> Bandwidth</div>
      <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-1 max-h-[84px] overflow-y-auto pr-1 space-y-0.5 font-mono scrollbar-none">
        {peers.slice(0, 3).map((peer, idx) => (
          <div key={idx} className="flex items-center justify-between p-1.5 hover:bg-zinc-900/40 rounded-md text-[8px] font-medium tracking-tight">
            <span className="text-zinc-400 truncate max-w-[90px] font-bold">{peer.ip}</span>
            <div className="flex items-center gap-3 font-bold text-zinc-300">
              <span>↓{parseFloat(peer.trafficDownMb || "0").toFixed(1)}M</span>
              <span className="text-zinc-500">↑{parseFloat(peer.trafficUpMb || "0").toFixed(1)}M</span>
            </div>
          </div>
        ))}
        {peers.length === 0 && <p className="text-zinc-600 text-center font-bold py-2 uppercase tracking-widest text-[7px] select-none">No connections</p>}
      </div>
    </div>
  )
}
