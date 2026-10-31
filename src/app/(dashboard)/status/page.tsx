'use client'

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Server, ShieldAlert, ArrowLeft } from "lucide-react"
import { WalletLayout } from "@/components/WalletLayout"
import { useWalletStatus } from "@/hooks/useWalletStatus" // 🎯 ИМПОРТИРУЕМ НАШ ЕДИНЫЙ ХУК

// Импортируем атомарные UI-компоненты
import { SyncCard } from "./_components/SyncCard"
import { TrafficList } from "./_components/TrafficList"
import { MetricsGrid } from "./_components/MetricsGrid"

export default function StatusPage() {
  const [blocksPerMinute, setBlocksPerMinute] = useState<number>(0)
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<string>("Расчет...")

  // Снимок для расчета BPM
  const prevSnapshotRef = useRef<{ height: number; timestamp: number } | null>(null)

  // 🎯 ЗАБИРАЕМ ВСЁ ИЗ НАШЕГО ЕДИНОГО ХУКА (Запрос идет в фоне сам, без дублирования)
  const { nodeData, isRpcDown } = useWalletStatus()

  useEffect(() => {
    if (!nodeData) return

    const currentHeight = nodeData.currentHeight
    const targetHeight = nodeData.targetHeight
    const prevSnapshot = prevSnapshotRef.current
    const now = Date.now()

    if (prevSnapshot && currentHeight > prevSnapshot.height) {
      const heightDiff = currentHeight - prevSnapshot.height
      const timeDiffMin = (now - prevSnapshot.timestamp) / 60000

      if (timeDiffMin > 0) {
        const currentBpm = Math.round(heightDiff / timeDiffMin)
        if (currentBpm > 0 && currentBpm < 5000) {
          setBlocksPerMinute(currentBpm)

          if (!nodeData.isSynced && currentBpm > 0) {
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

    if (nodeData.isSynced) {
      setEstimatedTimeLeft("Синхронизировано")
      setBlocksPerMinute(0)
    }

    prevSnapshotRef.current = {
      height: currentHeight,
      timestamp: now
    }
  }, [nodeData])

  return (
    <WalletLayout variant="dashboard">
      <div className="w-full space-y-5 select-none">

        {/* Верхняя навигационная панель */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60">
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

        {/* Индикатор сетевой ошибки (Если RPC ноды упала) */}
        {isRpcDown && (
          <div className="p-4 rounded-[24px] bg-zinc-900/20 border border-red-500/20 text-red-400 space-y-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-[#FF2E93]" />
              <span>Шлюз RPC недоступен</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500 font-medium">
              Не удалось прочитать состояние ноды. Проверьте статус локального демона Chia Full Node.
            </p>
          </div>
        )}

        {/* Состояние скелетона при первой загрузке */}
        {!nodeData && !isRpcDown && (
          <div className="py-14 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-5 h-5 border-2 border-zinc-800 border-t-[#FF2E93] rounded-full animate-spin" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
              Считывание ноды...
            </p>
          </div>
        )}

        {/* Основной контент */}
        {nodeData && (
          <div className="space-y-4 animate-in fade-in duration-300">

            {/* Карточка синхронизации */}
            <SyncCard
              network={nodeData.network}
              isSynced={nodeData.isSynced}
              isSyncingMode={nodeData.isSyncingMode}
              currentHeight={nodeData.currentHeight}
              targetHeight={nodeData.targetHeight}
              progressPercent={nodeData.progressPercent}
              estimatedTimeLeft={estimatedTimeLeft}
            />

            {/* Сетка метрик скорости и пиров */}
            <MetricsGrid
              blocksPerMinute={blocksPerMinute}
              totalPeers={nodeData.totalPeers}
            />

            {/* Список пиров с трафиком (кастим к any, так как peersList лежит внутри ответа) */}
            {/* 🎯 ТИПЫ ИСПРАВЛЕНЫ: Передаем проп peersList и убираем каст к any */}
            <TrafficList
              peersList={nodeData.peersList || []}
            />


          </div>
        )}
      </div>
    </WalletLayout>
  )
}
