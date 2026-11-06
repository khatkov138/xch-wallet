'use client'

import React, { useMemo, useState, useEffect, useRef } from "react"
import { AnimatedDigit } from "./AnimatedDigit"

interface StatusMetricsProps {
  currentHeight: number
  targetHeight: number
  isSynced: boolean
  peers: number
  rawState: any
}

function formatNetspace(bytes: any): string {
  const rawBytes = Number(bytes)
  if (!rawBytes || isNaN(rawBytes) || rawBytes <= 0) return "0 PiB"
  const k = 1024
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB']
  const i = Math.floor(Math.log(rawBytes) / Math.log(k))
  const value = parseFloat((rawBytes / Math.pow(k, i)).toFixed(2))
  return `${value} ${sizes[i]}`
}

export function StatusMetrics({ currentHeight, targetHeight, isSynced, rawState }: StatusMetricsProps) {
  const [tickerTime, setTickerTime] = useState(Date.now())
  const [blockChangedAt, setBlockReceivedAt] = useState<number>(Date.now())
  const prevHeightRef = useRef<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setTickerTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (currentHeight <= 0) return

    if (prevHeightRef.current === null) {
      const peakTimestamp = rawState?.peak?.timestamp
      if (peakTimestamp && peakTimestamp > 0) {
        const peakMs = peakTimestamp < 10000000000 ? peakTimestamp * 1000 : peakTimestamp
        setBlockReceivedAt(peakMs)
      } else {
        setBlockReceivedAt(Date.now())
      }
      prevHeightRef.current = currentHeight
      return
    }

    if (currentHeight > prevHeightRef.current) {
      setBlockReceivedAt(Date.now())
      prevHeightRef.current = currentHeight
    }
  }, [currentHeight, rawState?.peak?.timestamp])

  const liveSecondsDelta = useMemo(() => {
    if (currentHeight <= 0 || !blockChangedAt) return "0 сек."
    const diffInSeconds = Math.max(0, Math.floor((tickerTime - blockChangedAt) / 1000))
    return `${diffInSeconds} сек.`
  }, [blockChangedAt, tickerTime, currentHeight])

  const mempoolSize = rawState?.mempool_size ?? 0
  const netspaceFormatted = formatNetspace(rawState?.space)

  const digitsArray = useMemo(() => {
    if (currentHeight <= 0) return ["-", "-", "-"]
    return currentHeight.toLocaleString('ru-RU').split("")
  }, [currentHeight])
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-bold select-none w-full">
      
      {/* 👑 ГЛАВНЫЙ АКЦЕНТНЫЙ БЛОК: ВЫСОТА */}
      <div className="col-span-1 sm:col-span-2 bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-2xl flex flex-col justify-center min-h-[96px] relative overflow-hidden bg-gradient-to-br from-zinc-950/30 to-transparent">
        <p className="text-zinc-550 font-bold uppercase text-[8px] tracking-widest">Текушая высота блоков</p>
        
        <div className="flex items-center text-2xl sm:text-3xl font-black mt-1 tracking-tighter leading-none h-auto py-1 overflow-visible">
          {digitsArray.map((char, index) => (
            <AnimatedDigit key={index} digit={char} />
          ))}
        </div>

        <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 font-sans tracking-tight mt-2 border-t border-zinc-900/40 pt-2 selection:bg-[#FF2E93]/30">
          последний блок был создан <span className="font-mono font-bold tabular-nums text-zinc-400">{liveSecondsDelta}</span> назад
        </p>
      </div>

      {/* 💎 ЭТАЛОН: СТИЛЬНЫЙ МЕМПУЛ С НЕОНОВО-СИНИМ ИНДИКАТОРОМ (В СТИЛЕ ЛЕНДИНГА) */}
      <div className="bg-zinc-950/50 border border-zinc-800/60 p-4 rounded-2xl flex flex-col justify-between min-h-[86px] bg-gradient-to-br from-zinc-900/20 to-transparent shadow-lg shadow-black/10">
        <p className="text-zinc-400 font-black uppercase text-[8px] tracking-widest flex items-center gap-1">
          {/* 🚀 ИЗМЕНЕНО: Строгий неоново-синий светодиод из баджа WebSocket Live (bg-blue-400) */}
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa] animate-pulse" /> 
          Mempool очередь
        </p>
        <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight mt-1">
          {mempoolSize.toLocaleString('ru-RU')}
        </p>
        <p className="text-[9px] font-medium text-zinc-500 font-sans tracking-normal mt-1 border-t border-zinc-900/40 pt-1.5 lowercase">
          transactions in queue
        </p>
      </div>

      {/* 💤 СТАБИЛЬНЫЙ ФОН: ВЕС СЕТИ NETSPACE */}
      <div className="bg-zinc-950/40 border border-zinc-900/40 p-4 rounded-2xl flex flex-col justify-between min-h-[86px] bg-gradient-to-br from-zinc-950/5 to-transparent">
        <p className="text-zinc-650 font-bold uppercase text-[8px] tracking-tight">Общий вес сети</p>
        <p className="text-2xl sm:text-3xl font-black text-zinc-300 font-mono tracking-tight mt-1 opacity-85">
          {netspaceFormatted}
        </p>
        <p className="text-[9px] font-medium text-zinc-600 font-sans tracking-normal mt-1 border-t border-zinc-900/40 pt-1.5 lowercase">
          global network space
        </p>
      </div>

    </div>
  )
}
