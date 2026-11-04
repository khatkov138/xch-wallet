'use client'

import React, { useState, useEffect, useRef } from "react"
import { Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DerivedNodeStatus } from "@/hooks/useWalletStatus"

interface FloatingParticle {
  id: number;
  text: string;
}

interface SyncCardProps {
  nodeData: DerivedNodeStatus
  estimatedTimeLeft: string
}

function SyncFooterInfo({ 
  currentHeight, 
  cleanPercent, 
  estimatedTimeLeft 
}: { 
  currentHeight: number
  cleanPercent: string
  estimatedTimeLeft: string 
}) {
  const [secondsSinceLastBlock, setSecondsSinceLastBlock] = useState(0)
  const prevHeightRef = useRef<number>(currentHeight)

  useEffect(() => {
    setSecondsSinceLastBlock(0)
    prevHeightRef.current = currentHeight
  }, [currentHeight])

  useEffect(() => {
    const interval = setInterval(() => setSecondsSinceLastBlock((prev) => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const getUpdateTimeText = () => {
    if (secondsSinceLastBlock < 5) return "только что"
    if (secondsSinceLastBlock < 60) return `${secondsSinceLastBlock} сек. назад`
    return `${Math.floor(secondsSinceLastBlock / 60)} мин. назад`
  }

  return (
    <div className="space-y-1.5">
      <div className="w-full h-2 bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900/40 relative">
        <div 
          className="h-full bg-zinc-700 relative overflow-hidden transition-all duration-500"
          style={{ width: `${Math.min(parseFloat(cleanPercent), 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-400/30 to-zinc-200/50 animate-[waveFill_2.5s_infinite_ease-in-out]" />
        </div>
      </div>
      <div className="flex justify-between items-center text-[9px] font-mono font-bold text-zinc-600 px-0.5 leading-none">
        <span>0%</span>
        <span className="text-zinc-400 bg-zinc-900/60 border border-zinc-800/40 px-1.5 py-0.5 rounded">{cleanPercent}%</span>
        <span>100%</span>
      </div>
      <div className="flex items-center justify-between text-[9px] font-medium text-zinc-500 px-0.5 pt-0.5 leading-none">
        <div className="flex items-center gap-1.5">
          <span>Обновлено:</span>
          <span className={`font-mono font-bold transition-colors ${secondsSinceLastBlock > 30 ? "text-red-400/90 animate-pulse" : "text-zinc-400"}`}>{getUpdateTimeText()}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Осталось:</span>
          <span className="font-mono font-bold text-zinc-400 normal-case">{estimatedTimeLeft}</span>
        </div>
      </div>
    </div>
  )
}

export const SyncCard = React.memo(function SyncCard({ nodeData, estimatedTimeLeft }: SyncCardProps) {
  const [particles, setParticles] = useState<FloatingParticle[]>([])
  const prevHeightRef = useRef<number | null>(null)

  useEffect(() => {
    if (nodeData?.currentHeight) {
      const current = nodeData.currentHeight
      if (prevHeightRef.current !== null && current > prevHeightRef.current) {
        const diff = current - prevHeightRef.current
        const id = Date.now() + Math.random()
        setParticles((prev) => [...prev, { id, text: `+${diff} BL` }])
        setTimeout(() => setParticles((prev) => prev.filter((p) => p.id !== id)), 1000)
      }
      prevHeightRef.current = current
    }
  }, [nodeData?.currentHeight])

  if (!nodeData) return null

  const { currentHeight, targetHeight, progressPercent, isSynced, network } = nodeData
  const remainingBlocks = Math.max(0, targetHeight - currentHeight)
  const cleanPercent = parseFloat(progressPercent) ? parseFloat(progressPercent).toFixed(2) : "0.00"

  return (
    <div className="space-y-2.5 select-none">
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
        <Layers size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Статус ноды</span>
      </div>
      <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
        <CardContent className="p-2 space-y-1">
          <div className="flex items-center justify-between p-2.5 bg-zinc-900/10 border border-zinc-900/40 rounded-xl relative">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSynced ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                  <Layers size={16} className={isSynced ? "" : "animate-pulse"} />
                </div>
                {particles.map((p) => (
                  <span key={p.id} className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black text-emerald-400 font-mono pointer-events-none select-none animate-[pingUp_0.8s_ease-out_forwards]">{p.text}</span>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-none">{isSynced ? "Синхронизировано" : "Синхронизация блоков"}</p>
                <p className="text-[10px] font-medium text-zinc-500 font-mono tracking-tight mt-1.5 leading-none">
                  {isSynced ? <>Блок: <span className="text-zinc-300 font-bold">{currentHeight.toLocaleString()}</span></> : <>{currentHeight.toLocaleString()} / {targetHeight.toLocaleString()}</>}
                </p>
              </div>
            </div>
            <div className="text-right flex flex-col justify-center h-8">
              <p className={`text-xs font-black font-mono leading-tight ${isSynced ? "text-emerald-400" : "text-zinc-100"}`}>{isSynced ? "LIVE" : remainingBlocks.toLocaleString()}</p>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide mt-0.5 leading-none">{isSynced ? network.toLowerCase() : "осталось"}</p>
            </div>
          </div>
          <div className="px-1 pt-2 pb-0.5">
            {isSynced ? (
              <div className="flex items-center gap-1.5 text-[9px] font-medium text-zinc-500 px-0.5 leading-none">
                <span>Обновлено:</span>
                <span className="font-mono font-bold text-zinc-400">только что</span>
              </div>
            ) : (
              <SyncFooterInfo currentHeight={currentHeight} cleanPercent={cleanPercent} estimatedTimeLeft={estimatedTimeLeft} />
            )}
          </div>
        </CardContent>
      </Card>
      <style>{`
        @keyframes pingUp {
          0% { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
          15% { opacity: 1; transform: translate(-50%, -6px) scale(1.1); }
          100% { transform: translate(-50%, -24px) scale(0.9); opacity: 0; }
        }
        @keyframes waveFill {
          0% { transform: translateX(-100%); }
          70%, 100% { transform: translateX(0%); }
        }
      `}</style>
    </div>
  )
})

export default SyncCard;
