'use client'

import React, { useState, useEffect, useRef } from "react"
import { Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useWalletStatus } from "@/hooks/useWalletStatus"

interface FloatingParticle {
  id: number;
  text: string;
}

// 🎯 Изолируем реактивный подвал, чтобы секундные тикеры времени 
// НЕ перерендеривали иконки и всю карточку целиком
function SyncFooterInfo({ currentHeight, remainingBlocks, cleanPercent }: { currentHeight: number, remainingBlocks: number, cleanPercent: string }) {
  const [secondsSinceLastBlock, setSecondsSinceLastBlock] = useState(0)
  
  // Для расчета локальной скорости
  const [blocksPerSecond, setBlocksPerSecond] = useState<number | null>(null)
  const prevHeightRef = useRef<number>(currentHeight)
  const lastBlockTimeRef = useRef<number>(Date.now())

  // Виртуальный счетчик секунд, оставшихся до конца (дефолт: 5 часов = 18000 секунд)
  const [virtualSecondsLeft, setVirtualSecondsLeft] = useState(5 * 60 * 60)
  const hasRealSpeed = blocksPerSecond !== null && blocksPerSecond > 0

  // 1. Мониторим прилет блоков и вычисляем реальную скорость
  useEffect(() => {
    const now = Date.now()
    const timeDiffSeconds = (now - lastBlockTimeRef.current) / 1000

    if (currentHeight > prevHeightRef.current && timeDiffSeconds > 0) {
      const blockDiff = currentHeight - prevHeightRef.current
      const currentSpeed = blockDiff / timeDiffSeconds

      // Сглаживаем скорость (EMA) для плавного изменения таймера
      setBlocksPerSecond((prev) => (prev === null ? currentSpeed : prev * 0.7 + currentSpeed * 0.3))
    }

    setSecondsSinceLastBlock(0)
    prevHeightRef.current = currentHeight
    lastBlockTimeRef.current = now
  }, [currentHeight])

  // 2. Локальный тикер: срабатывает раз в секунду
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsSinceLastBlock((prev) => prev + 1)
      setVirtualSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // 3. Синхронизируем виртуальный таймер, если появилась реальная скорость
  useEffect(() => {
    if (hasRealSpeed) {
      const realSecondsLeft = remainingBlocks / blocksPerSecond
      setVirtualSecondsLeft(Math.round(realSecondsLeft))
    }
  }, [hasRealSpeed, remainingBlocks, blocksPerSecond])

  // Если сеть "молчит" слишком долго (больше 45 сек) — сбрасываем скорость на дефолтное уменьшение
  useEffect(() => {
    if (secondsSinceLastBlock > 45) {
      setBlocksPerSecond(null)
    }
  }, [secondsSinceLastBlock])

  // Форматируем секунды в красивую строку (~1ч 20м или ~45 сек.)
  const formatEta = (totalSeconds: number) => {
    if (totalSeconds <= 0) return "несколько секунд"
    if (totalSeconds < 60) return `~${Math.round(totalSeconds)} сек.`
    
    const totalMinutes = Math.round(totalSeconds / 60)
    if (totalMinutes < 60) return `~${totalMinutes} мин.`
    
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    return mins > 0 ? `~${hours}ч ${mins}м` : `~${hours}ч`
  }

  const getUpdateTimeText = () => {
    if (secondsSinceLastBlock < 5) return "только что"
    if (secondsSinceLastBlock < 60) return `${secondsSinceLastBlock} сек. назад`
    return `${Math.floor(secondsSinceLastBlock / 60)} мин. назад`
  }

  const isStalled = secondsSinceLastBlock > 30

  return (
    <div className="space-y-1.5">
      {/* 🛠 Утолщенная строгая подложка (h-2) */}
      <div className="w-full h-2 bg-zinc-950/60 rounded-full overflow-hidden border border-zinc-900/40 relative">
        
        {/* Контейнер текущего прогресса (задает максимальную ширину заполнения) */}
        <div 
          className="h-full bg-zinc-700 relative overflow-hidden transition-all duration-500"
          style={{ width: `${Math.min(parseFloat(cleanPercent), 100)}%` }}
        >
          {/* 🔥 НАКАТЫВАЮЩАЯ ВОЛНА ВЕРНУЛАСЬ! Циклически бежит от 0% до текущего заполнения */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-400/30 to-zinc-200/50 animate-[waveFill_2.5s_infinite_ease-in-out]" />
        </div>

      </div>

      {/* Шкала процентов: 0% | Текущие | 100% */}
      <div className="flex justify-between items-center text-[9px] font-mono font-bold text-zinc-600 px-0.5 leading-none">
        <span>0%</span>
        <span className="text-zinc-400 bg-zinc-900/60 border border-zinc-800/40 px-1.5 py-0.5 rounded">
          {cleanPercent}%
        </span>
        <span>100%</span>
      </div>

      {/* 📉 СДЕЛАНО ПОМЕНЬШЕ: Строчка инфо с мелким текстом и без капса в заголовках */}
      <div className="flex items-center justify-between text-[9px] font-medium text-zinc-500 px-0.5 pt-0.5 leading-none">
        <div className="flex items-center gap-1.5">
          <span>Обновлено:</span>
          <span className={`font-mono font-bold transition-colors ${isStalled ? "text-red-400/90 animate-pulse" : "text-zinc-400"}`}>
            {getUpdateTimeText()}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <span>Осталось:</span>
          <span className="font-mono font-bold text-zinc-400 normal-case">
            {formatEta(virtualSecondsLeft)}
          </span>
        </div>
      </div>
    </div>
  )
}

// 🎯 Главный каркас карточки статуса синхронизации
export const SyncCard = React.memo(function SyncCard() {
  const { nodeData, isLoading } = useWalletStatus()
  
  const [particles, setParticles] = useState<FloatingParticle[]>([])
  const prevHeightRef = useRef<number | null>(null)

  useEffect(() => {
    if (nodeData && nodeData.currentHeight) {
      const current = nodeData.currentHeight
      if (prevHeightRef.current !== null && current > prevHeightRef.current) {
        const diff = current - prevHeightRef.current
        const id = Date.now() + Math.random()
        
        setParticles((prev) => [...prev, { id, text: `+${diff} BL` }])

        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => p.id !== id))
        }, 1000)
      }
      prevHeightRef.current = current
    }
  }, [nodeData?.currentHeight])

  if (isLoading && !nodeData) {
    return (
      <div className="space-y-2.5">
        <div className="h-3 w-20 bg-zinc-900 rounded animate-pulse" />
        <div className="h-[74px] w-full bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] animate-pulse" />
      </div>
    )
  }

  if (!nodeData) return null

  const { currentHeight, targetHeight, progressPercent, isSynced, network } = nodeData

  const remainingBlocks = Math.max(0, targetHeight - currentHeight)
  const cleanPercent = parseFloat(progressPercent) ? parseFloat(progressPercent).toFixed(2) : "0.00"

  return (
    <div className="space-y-2.5 select-none">
      {/* Шапка группы элементов */}
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
        <Layers size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Статус ноды</span>
      </div>

      {/* Корневой блок карточки */}
      <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
        <CardContent className="p-2 space-y-1">
          
          <div className="flex items-center justify-between p-2.5 bg-zinc-900/10 border border-zinc-900/40 rounded-xl relative">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSynced ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                  <Layers size={16} className={isSynced ? "" : "animate-pulse"} />
                </div>
                {particles.map((p) => (
                  <span
                    key={p.id}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black text-emerald-400 font-mono pointer-events-none select-none animate-[pingUp_0.8s_ease-out_forwards]"
                  >
                    {p.text}
                  </span>
                ))}
              </div>

              <div>
                <p className="text-xs font-bold text-white leading-none">
                  {isSynced ? "Синхронизировано" : "Синхронизация блоков"}
                </p>
                <p className="text-[10px] font-medium text-zinc-500 font-mono tracking-tight mt-1.5 leading-none">
                  {currentHeight.toLocaleString()} / {targetHeight.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="text-right flex flex-col justify-center h-8">
              <p className={`text-xs font-black font-mono leading-tight ${isSynced ? "text-emerald-400" : "text-zinc-100"}`}>
                {isSynced ? "LIVE" : remainingBlocks.toLocaleString()}
              </p>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide mt-0.5 leading-none">
                {isSynced ? network : "осталось"}
              </p>
            </div>
          </div>

          {/* Информационный подвал */}
          <div className="px-1 pt-2 pb-0.5">
            {isSynced ? (
              <div className="flex items-center gap-1.5 text-[9px] font-medium text-zinc-500 px-0.5 leading-none">
                <span>Обновлено:</span>
                <span className="font-mono font-bold text-zinc-400">только что</span>
              </div>
            ) : (
              <SyncFooterInfo 
                currentHeight={currentHeight} 
                remainingBlocks={remainingBlocks} 
                cleanPercent={cleanPercent} 
              />
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
