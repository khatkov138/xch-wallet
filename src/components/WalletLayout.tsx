'use client'

import React from "react"
import { WalletHeader } from "./WalletHeader"
import Link from "next/link"
import { Server } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { handleApi } from "@/lib/utils"

interface WalletLayoutProps {
  children: React.ReactNode
  variant: "auth" | "dashboard"
  version?: string
}

interface NodeShortStatus {
  isSynced: boolean
}

export function WalletLayout({ children, variant, version }: WalletLayoutProps) {

  const { data: nodeData, isError, isLoading } = useQuery<NodeShortStatus>({
    queryKey: ['chiaNodeStatus'],
    queryFn: () => handleApi<NodeShortStatus>(fetch("/api/chia/rpc/node-status")),

    refetchInterval: 15000,
    staleTime: 5000,
  })

  let nodeStatusText = "..."
  let statusColorClass = "text-zinc-600"

  if (isError) {
    nodeStatusText = "Error"
    statusColorClass = "text-[#FF2E93] animate-pulse font-black"
  } else if (isLoading) {
    nodeStatusText = "..."
    statusColorClass = "text-zinc-500 animate-pulse"
  } else if (nodeData) {
    if (nodeData.isSynced) {
      nodeStatusText = "Synced"
      statusColorClass = "text-emerald-500 font-bold"
    } else {
      nodeStatusText = "Syncing"
      statusColorClass = "text-[#FF2E93] animate-pulse"
    }
  }

  return (
    <div className="relative z-10 w-full max-w-md mx-auto px-6 flex-1 flex flex-col justify-between py-10">

      <div className="w-full flex-1 flex flex-col justify-between">
        <div className="w-full space-y-6">
          <WalletHeader variant={variant} version={version} />
          <main className="w-full animate-in fade-in duration-300">
            {children}
          </main>
        </div>
      </div>

      <footer className="w-full text-center pt-8 flex flex-col items-center gap-3">

        <div className="flex items-center justify-center gap-4 w-full border-t border-zinc-900/60 pt-4">

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 transition-colors duration-200 group text-[10px] font-medium tracking-wide uppercase"
            title="Проверить исходный код на GitHub"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current transition-transform duration-200 group-hover:scale-110" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span>GitHub</span>
          </a>

          <span className="text-zinc-800 text-[10px] select-none">•</span>

          {/* Изменено: теперь используется понятное слово СЕТЬ */}
          <Link
            href="/status"
            className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 transition-colors duration-200 text-[10px] font-medium tracking-wide uppercase"
            title="Открыть панель мониторинга сети Chia"
          >
            <Server
              size={12}
              className={statusColorClass}
            />
            <span>Сеть: <span className={statusColorClass}>{nodeStatusText}</span></span>
          </Link>
        </div>

        <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mt-1">
          XCH Ecosystem • Secure Wallet Solution
        </p>
      </footer>

    </div>
  )
}
