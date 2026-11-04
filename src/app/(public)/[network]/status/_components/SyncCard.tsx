'use client'

import React, { useState, useEffect, useRef } from "react"
import { Layers } from "lucide-react"
import { DerivedNodeStatus } from "@/hooks/useWalletStatus"

interface FloatingParticle { id: number; text: string }

export const SyncCard = React.memo(function SyncCard({ 
  nodeData, 
  estimatedTimeLeft 
}: { 
  nodeData: DerivedNodeStatus
  estimatedTimeLeft: string 
}) {
  const [particles, setParticles] = useState<FloatingParticle[]>([])
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0)
  const prevHeightRef = useRef<number | null>(null)

  const { currentHeight, targetHeight, progressPercent, isSynced, isConnecting, network } = nodeData
  const remainingBlocks = Math.max(0, targetHeight - currentHeight)
  const cleanPercent = parseFloat(progressPercent) ? parseFloat(progressPercent).toFixed(2) : "0.00"

  useEffect(() => {
    setSecondsSinceUpdate(0)
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

  useEffect(() => {
    const interval = setInterval(() => setSecondsSinceUpdate((p) => p + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-2.5 select-none animate-in fade-in duration-150 text-[9px] w-full">
      {/* Верхняя статусная строка над блоком */}
      <div className="flex justify-between font-black text-zinc-500 px-0.5 uppercase tracking-widest">
        <span className="flex items-center gap-1.5"><Layers size={10} className="text-zinc-600" /> Стейт сети ({network})</span>
        <span className={isSynced ? "text-emerald-400" : isConnecting ? "text-amber-400" : "text-zinc-400"}>
          {isSynced ? "● Live" : isConnecting ? "○ Connecting" : "○ Syncing"}
        </span>
      </div>

      {/* Модульная сетка: Высота и Прогресс без лишних рамок карточки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-bold w-full">
        <div className="bg-zinc-900/20 border border-zinc-900 p-3 rounded-xl relative flex flex-col justify-between min-h-[52px]">
          {isSynced && <div className="absolute inset-0 m-auto w-16 h-6 bg-[#FF2E93]/5 blur-xl pointer-events-none" />}
          <p className="text-zinc-500 font-bold uppercase text-[8px] tracking-tight">Высота сети</p>
          <p className="text-xs font-black text-white font-mono mt-1 relative flex items-center gap-1">
            #{currentHeight.toLocaleString()}
            {particles.map((p) => (
              <span key={p.id} className="absolute -top-4 left-0 text-[8px] font-black text-[#FF2E93] font-mono animate-[pingUp_0.8s_ease-out_forwards]">{p.text}</span>
            ))}
          </p>
        </div>
        
        <div className="bg-zinc-900/20 border border-zinc-900 p-3 rounded-xl flex flex-col justify-between min-h-[52px]">
          <p className="text-zinc-500 font-bold uppercase text-[8px] tracking-tight">
            {isSynced ? "Статус синхронизации" : isConnecting ? "Поиск пиров" : "Осталось блоков"}
          </p>
          <p className={`text-xs font-black font-mono mt-1 ${isSynced ? "text-emerald-400" : "text-white"}`}>
            {isSynced ? "100.00%" : isConnecting ? "0.00%" : remainingBlocks.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Плашка живого статуса ядра */}
      <div className="p-1 bg-zinc-900/10 border border-zinc-900 rounded-xl font-mono w-full">
        <div className="flex justify-between p-2.5 bg-[#FF2E93]/5 border border-[#FF2E93]/10 rounded-lg font-bold text-white items-center">
          <div className="flex items-center gap-2">
            <span className={`relative flex h-1.5 w-1.5 ${isSynced ? "text-emerald-400" : "text-[#FF2E93]"}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
            </span>
            <span className="text-zinc-200">
              {isSynced ? "Нода активна" : isConnecting ? "Поиск соединений..." : `Синхронизация блоков: ${cleanPercent}%`}
            </span>
          </div>
          <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-wider">
            {isSynced ? "только что" : isConnecting ? "ожидание" : `${secondsSinceUpdate} сек назад`}
          </span>
        </div>
      </div>

      {/* Нижняя строка с расчетным временем */}
      {!isSynced && !isConnecting && (
        <div className="flex justify-between items-center text-[8px] font-bold uppercase text-zinc-500 px-1 pt-0.5 leading-none tracking-tight">
          <span>Оставшееся время до полной синхронизации:</span>
          <span className="font-mono font-black text-zinc-300 normal-case">{estimatedTimeLeft}</span>
        </div>
      )}

      <style>{`
        @keyframes pingUp {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          15% { opacity: 1; transform: translateY(-4px) scale(1.1); }
          100% { transform: translateY(-16px) scale(0.9); opacity: 0; }
        }
      `}</style>
    </div>
  )
})

export default SyncCard;
