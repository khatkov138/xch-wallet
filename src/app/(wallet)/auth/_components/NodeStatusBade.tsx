'use client'

import React from "react"
// 🛡️ ИСПРАВЛЕНО: Импортируем Link из правильного пакета фреймворка
import Link from "next/link"
import { Server } from "lucide-react"
import { useWalletStatus } from "@/hooks/useWalletStatus"

export function NodeStatusBadge() {
  const { nodeData, isPythonDown, isRpcDown } = useWalletStatus()

  let nodeStatusText = "..."
  let statusColorClass = "text-zinc-650"

  if (isPythonDown || isRpcDown) {
    nodeStatusText = "Error"
    statusColorClass = "text-[#FF2E93] font-black"
  } else if (nodeData) {
    if (nodeData.isSynced) {
      nodeStatusText = "Synced"
      statusColorClass = "text-emerald-500 font-bold"
    } else {
      nodeStatusText = "Syncing..."
      statusColorClass = "text-zinc-400 font-bold"
    }
  }

  return (
    <Link
      href="/status"
      className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 transition-colors duration-200 text-[10px] font-medium tracking-wide uppercase"
      title="Открыть панель мониторинга сети Chia"
    >
      <Server size={12} className={statusColorClass} />
      <span>Сеть: <span className={`${statusColorClass} inline-block min-w-[55px] text-left`}>{nodeStatusText}</span></span>
    </Link>
  )
}
