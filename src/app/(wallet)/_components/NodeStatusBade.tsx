'use client'

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Server } from "lucide-react"
import { useNodesStatus } from "@/hooks/useNodesStatus"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

export function NodeStatusBadge() {
  // 🏭 Достаем активную сеть кошелька из Zustand стора ('mainnet' или 'testnet11')
  const network = useUserSettingsStore((state) => state.network)
  const { isPythonDown, networks } = useNodesStatus()
  const [isClientReady, setIsClientReady] = useState(false)
  
  useEffect(() => {
    setIsClientReady(true)
  }, [])

  // Красивое форматирование имени текущей сети
  const displayNetwork = network === 'mainnet' ? 'Mainnet' : 'Testnet11'

  // Вытаскиваем статус конкретно той ноды, которая сейчас выбрана пользователем
  const activeNodeStatus = networks[network] || { isLoading: true, isRpcDown: false, nodeData: null };
  const { nodeData, isRpcDown, isLoading } = activeNodeStatus

  // ─── 1. ИСПРАВЛЕНО: СЕРВЕРНЫЙ ПРОХОД И ПЕРВИЧНАЯ ЗАГРУЗКА ───
  // Заменили дезинформирующий "Online" на нейтральный приглушенный "Loading..." с эффектом пульсации
  if (!isClientReady || (isLoading && !nodeData && !isPythonDown && !isRpcDown)) {
    return (
      <Link
        href="/nodes/status"
        className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-500 transition-colors duration-200 text-[10px] font-medium tracking-wide uppercase font-mono"
        title="Подключение к узлу мониторинга..."
      >
        <Server size={12} className="text-zinc-600 animate-pulse" />
        <span>
          {displayNetwork} :{' '}
          <span className="text-zinc-600 inline-block min-w-[55px] text-left font-bold animate-pulse">
            Loading...
          </span>
        </span>
      </Link>
    )
  }

  // ─── 2. ВТОРОЙ ПРОХОД (РЕАЛЬНЫЙ СТАТУС НА КЛИЕНТЕ) ───
  let nodeStatusText = "Online"
  let statusColorClass = "text-zinc-650"

  if (isPythonDown || isRpcDown) {
    nodeStatusText = "Offline"
    statusColorClass = "text-[#FF2E93] font-black"
  } else if (nodeData) {
    if (nodeData.isConnecting) {
      nodeStatusText = "Connecting"
      statusColorClass = "text-amber-500 font-bold"
    } else if (nodeData.isSynced) {
      nodeStatusText = "Synced"
      statusColorClass = "text-emerald-500 font-bold"
    } else {
      nodeStatusText = "Syncing"
      statusColorClass = "text-zinc-400 font-bold"
    }
  }

  return (
    <Link
      href="/nodes/status" 
      className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 transition-colors duration-200 text-[10px] font-medium tracking-wide uppercase font-mono"
      title="Открыть панель мониторинга сети Chia"
    >
      <Server size={12} className={`${statusColorClass} transition-colors duration-350`} />
      <span>
        {displayNetwork} :{' '}
        <span className={`${statusColorClass} inline-block min-w-[55px] text-left transition-colors duration-350`}>
          {nodeStatusText}
        </span>
      </span>
    </Link>
  )
}
