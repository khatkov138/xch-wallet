'use client'

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Server, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { WalletLayout } from "@/components/WalletLayout"
import { handleApi } from "@/lib/utils"

// Подключаем твои компоненты
import { SyncCard } from "./_components/SyncCard"
import { MetricsGrid } from "./_components/MetricsGrid"
import { TrafficList } from "./_components/TrafficList"

export interface PeerInfo {
  ip: string;
  port: number;
  trafficUpMb: string;
  trafficDownMb: string;
}

export interface NodeStatus {
  network: string;
  isSynced: boolean;
  isSyncingMode: boolean;
  currentHeight: number;
  targetHeight: number;
  progressPercent: string;
  difficulty: number;
  networkSpaceTib: string;
  peakTime: string;
  totalPeers: number;
  peersList: PeerInfo[];
}

export default function StatusPage() {
  const [blocksPerMinute, setBlocksPerMinute] = useState<number>(0)
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<string>("Расчет...")

  // Ссылка useRef спасает нас от бесконечного цикла обновлений
  const prevSnapshotRef = useRef<{ height: number; timestamp: number } | null>(null)

  const {
    data: statusData,
    error: nodeError,
    refetch,
    isFetching,
    dataUpdatedAt
  } = useQuery<NodeStatus>({
    queryKey: ['chiaNodeStatus'],
    queryFn: () => handleApi<NodeStatus>(fetch("/api/rpc/node-status")),
    refetchInterval: 3000,
    staleTime: 2000,
  })

  useEffect(() => {
    if (!statusData) return

    const currentHeight = statusData.currentHeight
    const targetHeight = statusData.targetHeight
    const prevSnapshot = prevSnapshotRef.current

    if (prevSnapshot && currentHeight > prevSnapshot.height) {
      const heightDiff = currentHeight - prevSnapshot.height
      const timeDiffMin = (dataUpdatedAt - prevSnapshot.timestamp) / 60000

      if (timeDiffMin > 0) {
        const currentBpm = Math.round(heightDiff / timeDiffMin)
        if (currentBpm > 0 && currentBpm < 5000) {
          setBlocksPerMinute(currentBpm)

          if (!statusData.isSynced && currentBpm > 0) {
            const blocksLeft = targetHeight - currentHeight
            const minutesLeft = blocksLeft / currentBpm

            if (minutesLeft <= 0) {
              setEstimatedTimeLeft("Пару секунд")
            } else if (minutesLeft < 60) {
              setEstimatedTimeLeft(`${Math.round(minutesLeft)} мин`)
            } else {
              const hours = Math.floor(minutesLeft / 60)
              const days = Math.floor(hours / 24)
              const remainingHours = Math.round(hours % 24)

              if (days > 0) {
                setEstimatedTimeLeft(`~${days}д ${remainingHours}ч`)
              } else {
                setEstimatedTimeLeft(`~${hours}ч ${Math.round(minutesLeft % 60)}мин`)
              }
            }
          }
        }
      }
    }

    if (statusData.isSynced) {
      setEstimatedTimeLeft("Синхронизировано")
      setBlocksPerMinute(0)
    }

    prevSnapshotRef.current = {
      height: currentHeight,
      timestamp: dataUpdatedAt
    }
  }, [statusData, dataUpdatedAt])

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white font-sans antialiased overflow-hidden flex flex-col justify-between">
      <div className="absolute top-[-10%] right-[-20%] w-[130%] h-[50vh] bg-gradient-to-bl from-[#B82EFF]/15 via-[#FF2E93]/5 to-transparent blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[80vw] h-[50vh] bg-[#FF2E93]/5 blur-[120px] pointer-events-none z-0" />

      <WalletLayout variant="dashboard">
        <div className="w-full max-w-md mx-auto px-6 space-y-5 select-none relative z-10">

          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#FF2E93]" />
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-200">
                Статус Chia Ноды
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft size={12} />
              <span>Кошелек</span>
            </Link>
          </div>

          {nodeError && (
            <div className="p-4 rounded-2xl bg-zinc-900/30 border border-red-500/20 text-red-400 space-y-3 animate-in fade-in zoom-in-95 duration-200 shadow-lg shadow-red-950/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-[#FF2E93]" />
                  <span>Шлюз RPC недоступен</span>
                </div>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200 active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw size={11} className={isFetching ? "animate-spin text-[#FF2E93]" : ""} />
                </button>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] leading-relaxed text-zinc-400 font-medium">
                  `handleApi` внутри TanStack Query поймал невалидный контент или ошибку сети.
                </p>
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/40 text-[10px] font-mono text-zinc-500 break-words leading-normal max-h-[120px] overflow-y-auto">
                  <span className="text-red-400/90 font-bold">Status:</span> {String(nodeError)}
                </div>
              </div>
            </div>
          )}

          {!statusData && !nodeError && (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-[#FF2E93] rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
                Считывание ноды...
              </p>
            </div>
          )}

          {statusData && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <SyncCard
                isSynced={statusData.isSynced}
                isSyncingMode={statusData.isSyncingMode}
                currentHeight={statusData.currentHeight}
                targetHeight={statusData.targetHeight}
                progressPercent={statusData.progressPercent}
                estimatedTimeLeft={estimatedTimeLeft}
              />

              {/* Рендерим твой оригинальный компонент */}
              <MetricsGrid
                blocksPerMinute={blocksPerMinute}
                totalPeers={statusData.totalPeers}
              />

              <div className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-800/50 space-y-2.5 text-[11px] font-medium text-zinc-400">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Объем сети (Netspace):</span>
                  <span className="font-mono text-zinc-300 font-bold">{statusData.networkSpaceTib} TiB</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Сложность (Difficulty):</span>
                  <span className="font-mono text-zinc-300 font-bold">{statusData.difficulty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Время пикового блока:</span>
                  <span className="font-mono text-zinc-300 font-bold">{statusData.peakTime}</span>
                </div>
              </div>

              <TrafficList peersList={statusData.peersList} />
            </div>
          )}
        </div>
      </WalletLayout>
    </div>
  )
}
