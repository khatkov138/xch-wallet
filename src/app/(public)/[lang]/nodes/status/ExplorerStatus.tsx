'use client'

import React, { useState, useEffect } from "react"
import { NetworkStatusCard } from "./_components/NetworkStatusCard"
import { useWalletStatus } from "@/hooks/useWalletStatus"

export default function ExplorerStatus() {
  const [isClientReady, setIsClientReady] = useState(false)
  const { nodeData, isRpcDown, isLoading } = useWalletStatus()

  useEffect(() => { setIsClientReady(true) }, [])

  if (!isClientReady || (isLoading && !nodeData && !isRpcDown)) return (
    <div className="py-20 flex flex-col items-center justify-center gap-3 text-center flex-1 text-[9px]">
      <div className="w-5 h-5 border-2 border-zinc-800 border-t-[#FF2E93] rounded-full animate-spin" />
      <p className="font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Инициализация мониторинга узлов...</p>
    </div>
  )

  return (
    /* 🎯 Чистый, монолитный контейнер без мерцаний при обновлении страницы */
    <div className="w-full space-y-6 py-4 text-[9px]">
      
      {/* ЗАГОЛОВОК ИНФРАСТРУКТУРЫ */}
      <div className="text-center space-y-2 max-w-xl mx-auto border-b border-zinc-900/60 pb-5">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          xChia Nodes <span className="bg-gradient-to-r from-[#FF2E93] to-[#8B5CF6] bg-clip-text text-transparent">Status</span>
        </h1>
        <p className="text-xs text-zinc-550 font-medium">
          Синхронный паблик-мониторинг и аудит локальных демонов Chia Full Node в реальном времени.
        </p>
      </div>

      {/* СЕТКА КАРТОЧЕК */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch max-w-4xl mx-auto">
        
        {/* Панель 1: MAINNET */}
        <div className="flex flex-col h-full min-h-[250px]">
          <NetworkStatusCard 
            networkName="MAINNET"
            nodeData={nodeData?.network === 'mainnet' ? nodeData : null}
            isRpcDown={isRpcDown && nodeData?.network === 'mainnet'}
            blocksPerMinute={nodeData?.network === 'mainnet' ? 4 : 0}
          />
        </div>

        {/* Панель 2: TESTNET11 */}
        <div className="flex flex-col h-full min-h-[250px]">
          <NetworkStatusCard 
            networkName="TESTNET11"
            nodeData={nodeData?.network === 'testnet11' ? nodeData : null}
            isRpcDown={isRpcDown}
            blocksPerMinute={nodeData?.network === 'testnet11' ? 12 : 0}
          />
        </div>

      </div>
    </div>
  )
}
