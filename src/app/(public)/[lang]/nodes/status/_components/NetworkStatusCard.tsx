'use client'

import React, { useState, useEffect, useRef } from "react"
import { ShieldAlert } from "lucide-react"
import { StatusHeader, StatusMetrics, LiveTicker, TrafficMiniList } from "./SubComponents"

interface PeerInfo {
  ip: string
  port: number
  trafficUpMb: string
  trafficDownMb: string
}

interface DerivedNodeStatus {
  network: string
  currentHeight: number
  targetHeight: number
  progressPercent: string
  isSynced: boolean
  isConnecting: boolean
  totalPeers: number
  peersList: PeerInfo[]
}

interface NetworkStatusCardProps {
  networkName: string
  nodeData: DerivedNodeStatus | null
  isRpcDown: boolean
  blocksPerMinute: number
}

export function NetworkStatusCard({ networkName, nodeData, isRpcDown, blocksPerMinute }: NetworkStatusCardProps) {
  const [seconds, setSeconds] = useState(0)
  const h = nodeData?.currentHeight ?? 0

  // Секундомер пакетов
  useEffect(() => {
    setSeconds(0)
    const i = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(i)
  }, [h])

  return (
    /* 🎯 Жесткий, моментальный рендер без мерцания и анимаций появления */
    <div className="w-full h-full flex flex-col justify-between bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-4 shadow-2xl relative overflow-hidden text-[9px] text-zinc-400 selection:bg-[#FF2E93]/30 min-h-[250px]">
      
      {/* Шапка (Всегда сверху) */}
      <StatusHeader 
        network={networkName} 
        isRpcDown={isRpcDown} 
        isConnecting={nodeData?.isConnecting ?? false} 
      />

      {isRpcDown ? (
        /* СТРОГИЙ ЭКРАН ОШИБКИ ИЗ ДИЗАЙН-СИСТЕМЫ */
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-2 flex-1 justify-center">
          <div className="h-8 w-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <ShieldAlert size={14} />
          </div>
          <p className="text-white font-bold text-[9px] uppercase tracking-wider">Шлюз RPC недоступен</p>
          <p className="text-zinc-600 max-w-[200px] leading-relaxed text-[8px] font-medium">
            Локальный демон Chia Full Node выключен или запускается.
          </p>
        </div>
      ) : (
        /* ЖИВОЙ КОМПАКТНЫЙ МОНИТОР (Текст мгновенно контрастен, без фейдов) */
        <div className="space-y-3.5 relative z-10 flex-1 flex flex-col justify-between mt-3.5">
          
          {/* Сетка метрик (Передаем пустой массив вместо частиц, чтобы убрать прыжки) */}
          <StatusMetrics 
            currentHeight={h} 
            targetHeight={nodeData?.targetHeight ?? 0} 
            isSynced={nodeData?.isSynced ?? false} 
            bpm={blocksPerMinute} 
            peers={nodeData?.totalPeers ?? 0} 
            particles={[]} 
            onStyle="" 
          />
          
          {/* Инлайн-тикер */}
          <LiveTicker 
            isSynced={nodeData?.isSynced ?? false} 
            isConnecting={nodeData?.isConnecting ?? false} 
            cleanPercent={parseFloat(nodeData?.progressPercent || "0").toFixed(2)} 
            seconds={seconds} 
          />
          
          {/* Список трафика бандвида */}
          <TrafficMiniList peers={nodeData?.peersList || []} />
          
        </div>
      )}
    </div>
  )
}
