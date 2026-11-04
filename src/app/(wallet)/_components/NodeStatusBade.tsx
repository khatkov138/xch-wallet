'use client'

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Server } from "lucide-react"
import { useWalletStatus } from "@/hooks/useWalletStatus"

export function NodeStatusBadge() {
  const { nodeData, isPythonDown, isRpcDown } = useWalletStatus()
  const [isClientReady, setIsClientReady] = useState(false)
  
  useEffect(() => {
    setIsClientReady(true)
  }, [])

  // ─── 1. СЕРВЕРНЫЙ ПРОХОД И ПЕРВИЧНАЯ ЗАГРУЗКА ───
  // Показываем стабильное нейтральное состояние до гидратации и до первого пакета
  if (!isClientReady || (!nodeData && !isPythonDown && !isRpcDown)) {
    return (
      <Link
        href="/status"
        className="flex items-center gap-1.5 text-zinc-650 hover:text-zinc-500 transition-colors duration-200 text-[10px] font-medium tracking-wide uppercase"
        title="Подключение к узлу мониторинга..."
      >
        <Server size={12} className="text-zinc-650 transition-colors duration-300" />
        <span>
          Сеть:{' '}
          <span className="text-zinc-650 inline-block min-w-[55px] text-left">
            Online
          </span>
        </span>
      </Link>
    )
  }

  // ─── 2. ВТОРОЙ ПРОХОД (РЕАЛЬНЫЙ СТАТУС НА КЛИЕНТЕ) ───
  let nodeStatusText = "Online"
  let statusColorClass = "text-zinc-650"

  if (isPythonDown || isRpcDown) {
    nodeStatusText = "Error"
    statusColorClass = "text-[#FF2E93] font-black"
  } else if (nodeData) {
    if (nodeData.isSynced) {
      nodeStatusText = "Synced"
      statusColorClass = "text-emerald-500 font-bold"
    } else {
      nodeStatusText = "Syncing"
      statusColorClass = "text-zinc-400 font-bold"
    }
  }

  return (
    <Link
      href="/explorer/status"
      className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 transition-colors duration-200 text-[10px] font-medium tracking-wide uppercase"
      title="Открыть панель мониторинга сети Chia"
    >
      <Server size={12} className={`${statusColorClass} transition-colors duration-350`} />
      <span>
        Сеть:{' '}
        <span className={`${statusColorClass} inline-block min-w-[55px] text-left transition-colors duration-350`}>
          {nodeStatusText}
        </span>
      </span>
    </Link>
  )
}
