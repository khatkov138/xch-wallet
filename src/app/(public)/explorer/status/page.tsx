'use client'

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Server, ShieldAlert, ArrowLeft } from "lucide-react"
import { useWalletStatus } from "@/hooks/useWalletStatus" 
import { SyncCard } from "./_components/SyncCard"
import { TrafficList } from "./_components/TrafficList"
import { MetricsGrid } from "./_components/MetricsGrid"

export default function StatusPage() {
  const [blocksPerMinute, setBlocksPerMinute] = useState<number>(0)
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<string>("Расчет...")
  const [isClientReady, setIsClientReady] = useState<boolean>(false)
  const prevSnapshotRef = useRef<{ height: number; timestamp: number } | null>(null)

  const { nodeData, isRpcDown, isLoading } = useWalletStatus()

  useEffect(() => { setIsClientReady(true) }, [])

  useEffect(() => {
    if (!isClientReady || !nodeData) return
    const currentHeight = nodeData.currentHeight
    const targetHeight = nodeData.targetHeight
    const now = Date.now()

    if (!prevSnapshotRef.current) {
      prevSnapshotRef.current = { height: currentHeight, timestamp: now }
      return
    }

    const prev = prevSnapshotRef.current
    const timePassedMs = now - prev.timestamp

    if (timePassedMs >= 5000) {
      const heightDiff = currentHeight - prev.height
      const timeDiffMin = timePassedMs / 60000

      if (heightDiff >= 0 && timeDiffMin > 0) {
        const currentBpm = Math.round(heightDiff / timeDiffMin)
        setBlocksPerMinute(currentBpm)

        if (nodeData.isSyncingMode && !nodeData.isSynced) {
          if (currentBpm > 0) {
            const blocksLeft = targetHeight - currentHeight
            const minutesLeft = blocksLeft / currentBpm
            if (minutesLeft <= 0) setEstimatedTimeLeft("Пару секунд")
            else if (minutesLeft < 60) setEstimatedTimeLeft(`${Math.round(minutesLeft)} мин`)
            else {
              const hours = Math.floor(minutesLeft / 60)
              const days = Math.floor(hours / 24)
              const remainingHours = Math.round(hours % 24)
              if (days > 0) setEstimatedTimeLeft(`~${days}д ${remainingHours}ч`)
              else setEstimatedTimeLeft(`~${hours}ч ${Math.round(minutesLeft % 60)}мин`)
            }
          } else { setEstimatedTimeLeft("Нода ожидает блоки...") }
        }
      }
      prevSnapshotRef.current = { height: currentHeight, timestamp: now }
    }

    if (nodeData.isSynced && !nodeData.isSyncingMode) {
      setEstimatedTimeLeft("Синхронизировано")
      setBlocksPerMinute(0)
    }
  }, [nodeData, isClientReady])

  if (!isClientReady) {
    return (
      <div className="w-full space-y-5 select-none">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#FF2E93]" />
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-200">
              Статус Chia Ноды
            </h2>
          </div>
          <Link
            href="/wallet"
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={12} />
            <span>Кошелек</span>
          </Link>
        </div>
        <div className="py-14 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-5 h-5 border-2 border-zinc-800 border-t-[#FF2E93] rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
            Считывание ноды...
          </p>
        </div>
      </div>
    )
  }

  const showSkeleton = isLoading && !nodeData && !isRpcDown

  return (
    <div className="w-full space-y-5 select-none animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[#FF2E93]" />
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-200">
            Статус Chia Ноды
          </h2>
        </div>
        <Link
          href="/wallet"
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={12} />
          <span>Кошелек</span>
        </Link>
      </div>

      {isRpcDown && (
        <div className="p-4 rounded-[24px] bg-zinc-900/20 border border-red-500/20 text-red-400 space-y-2 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-[#FF2E93]" />
            <span>Шлюз RPC недоступен</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500 font-medium">
            Не удалось получить состояние ноды. Домашний скрипт-мост активен, но локальный демон Chia Full Node выключен или запускается.
          </p>
        </div>
      )}

      {showSkeleton && (
        <div className="py-14 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-5 h-5 border-2 border-zinc-800 border-t-[#FF2E93] rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
            Считывание ноды...
          </p>
        </div>
      )}

      {nodeData && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <SyncCard 
            nodeData={nodeData} 
            estimatedTimeLeft={estimatedTimeLeft} 
          />
          <MetricsGrid
            nodeData={nodeData}
            blocksPerMinute={blocksPerMinute}
            totalPeers={nodeData.totalPeers}
          />
          <TrafficList
            peersList={nodeData.peersList}
          />
        </div>
      )}
    </div>
  )
}
