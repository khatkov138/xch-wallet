'use client'

import React from "react"
import { ShieldAlert } from "lucide-react"
import { StatusHeader } from "./StatusHeader"
import { StatusMetrics } from "./StatusMetrics"
import { LiveTicker } from "./LiveTicker"
import { TrafficMiniList } from "./TrafficMiniList"

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
  peakTime: string | number | null
  blockchain_state?: any
  updatedAt: number 
}

interface NetworkStatusCardProps {
  networkName: string
  nodeData: DerivedNodeStatus | null
  isRpcDown: boolean
}

export function NetworkStatusCard({ networkName, nodeData, isRpcDown }: NetworkStatusCardProps) {
  const h = nodeData?.currentHeight ?? 0
  const rawBlockchainState = nodeData?.blockchain_state ?? (nodeData as any)?.rawState ?? null

  return (
    <div className="w-full h-auto flex flex-col justify-between bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-5 shadow-2xl relative overflow-hidden text-[9px] text-zinc-400 selection:bg-[#FF2E93]/30 pb-5">

      {/* 🚀 ИЗМЕНЕНО: Теперь передаем реальный статус синхронизации isSynced, чтобы шапка не врала */}
      <StatusHeader
        network={networkName}
        isRpcDown={isRpcDown}
        isConnecting={nodeData?.isConnecting ?? false}
        isSynced={nodeData?.isSynced ?? true}
      />

      {isRpcDown ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 flex-1 justify-center">
          <div className="h-8 w-8 rounded-[18px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <ShieldAlert size={14} />
          </div>
          <p className="text-white font-bold text-[9px] uppercase tracking-wider">Шлюз RPC недоступен</p>
          <p className="text-zinc-600 max-w-[200px] leading-relaxed text-[8px] font-medium">
            Локальный демон Chia Full Node выключен или запускается.
          </p>
        </div>
      ) : (
        <div className="space-y-4 relative z-10 flex-1 flex flex-col justify-between mt-4">
          {/* 🚀 ИЗМЕНЕНО: Очистили пропсы от packetTimeMs, так как метрика стала автономной */}
          <StatusMetrics
            currentHeight={h}
            targetHeight={nodeData?.targetHeight ?? 0}
            isSynced={nodeData?.isSynced ?? false}
            peers={nodeData?.totalPeers ?? 0}
            rawState={rawBlockchainState}
          />

          <LiveTicker 
  isSynced={nodeData?.isSynced ?? false} 
  isConnecting={nodeData?.isConnecting ?? false} 
  cleanPercent={parseFloat(nodeData?.progressPercent || "0").toFixed(2)} 
  currentHeight={h} // 🚀 ДОБАВИЛИ ВЫСОТУ НОДЫ
  targetHeight={nodeData?.targetHeight ?? 0} // 🚀 ДОБАВИЛИ ЦЕЛЬ СЕТИ
/>

          <TrafficMiniList peers={nodeData?.peersList || []} />
        </div>
      )}
    </div>
  )
}
