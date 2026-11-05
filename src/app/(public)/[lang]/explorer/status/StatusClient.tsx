// app/(public)/[network]/status/StatusClient.tsx
'use client'

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { useWalletStatus } from "@/hooks/useWalletStatus" 
import { SyncCard } from "./_components/SyncCard"
import { TrafficList } from "./_components/TrafficList"
import { MetricsGrid } from "./_components/MetricsGrid"

export default function StatusClient() {
  const [blocksPerMinute, setBlocksPerMinute] = useState(0)
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState("Расчет...")
  const [isClientReady, setIsClientReady] = useState(false)
  const prevSnapshotRef = useRef<{ height: number; timestamp: number } | null>(null)
  const { nodeData, isRpcDown, isLoading } = useWalletStatus()

  useEffect(() => { setIsClientReady(true) }, [])

  useEffect(() => {
    if (!isClientReady || !nodeData) return
    if (nodeData.isConnecting || (nodeData.isSynced && !nodeData.isSyncingMode)) {
      setEstimatedTimeLeft(nodeData.isConnecting ? "Ожидание сети..." : "Синхронизировано")
      setBlocksPerMinute(0)
      return
    }
    const now = Date.now()
    if (!prevSnapshotRef.current) { prevSnapshotRef.current = { height: nodeData.currentHeight, timestamp: now }; return }
    
    const prev = prevSnapshotRef.current
    if (now - prev.timestamp >= 5000) {
      const hDiff = nodeData.currentHeight - prev.height
      const cBpm = Math.round(hDiff / ((now - prev.timestamp) / 60000))
      setBlocksPerMinute(cBpm)
      if (nodeData.isSyncingMode && !nodeData.isSynced && cBpm > 0) {
        const minLeft = (nodeData.targetHeight - nodeData.currentHeight) / cBpm
        setEstimatedTimeLeft(minLeft <= 0 ? "Пару секунд" : minLeft < 60 ? `${Math.round(minLeft)} мин` : `~${Math.floor(minLeft / 60)}ч ${Math.round(minLeft % 60)}мин`)
      } else { setEstimatedTimeLeft("Нода ожидает блоки...") }
      prevSnapshotRef.current = { height: nodeData.currentHeight, timestamp: now }
    }
  }, [nodeData, isClientReady])

  if (!isClientReady || (isLoading && !nodeData && !isRpcDown)) return (
    <div className="py-20 flex flex-col items-center justify-center gap-3 text-center flex-1 text-[9px]"><div className="w-5 h-5 border-2 border-zinc-800 border-t-[#FF2E93] rounded-full animate-spin" /><p className="font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Считывание состояния сети...</p></div>
  )

  return (
    <div className="w-full flex flex-col justify-between flex-1 selection:bg-[#FF2E93]/30 text-[9px]">
      <header className="w-full h-14 flex items-center justify-between border-b border-zinc-900/40 backdrop-blur-sm bg-zinc-950/10 rounded-xl px-2 mb-6">
        <div className="flex items-center gap-2 select-none"><Link href="/" className="relative bg-zinc-900/40 border border-zinc-850 text-white font-black text-xs px-3 py-1 rounded-xl">XCH<span className="text-[#FF2E93]">IA</span><span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#FF2E93]" /></Link><span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded border text-zinc-500 bg-zinc-900/20 border-zinc-900 uppercase">{nodeData?.network ?? "TESTNET11"}</span></div>
        <Link href="/wallet" className="text-[11px] font-bold uppercase bg-white text-zinc-950 px-3.5 py-1.5 rounded-xl hover:bg-zinc-200 transition-all flex items-center gap-1"><ArrowLeft size={11} /> Назад</Link>
      </header>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start py-4 flex-1">
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-400"><span className={`h-1 w-1 rounded-full animate-pulse ${isRpcDown ? 'bg-red-500' : 'bg-emerald-500'}`} />МОНИТОРИНГ ДЕМОНА CHIA FULL NODE</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-none">Node <br /><span className="bg-gradient-to-r from-[#FF2E93] to-[#8B5CF6] bg-clip-text text-transparent">Status</span></h1>
          {isRpcDown && <div className="p-4 rounded-[24px] bg-[#0c0c0e] border border-red-500/20 text-red-400 space-y-2"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><ShieldAlert className="w-4 h-4 text-[#FF2E93]" /><span>Шлюз RPC недоступен</span></div><p className="text-[11px] leading-relaxed text-zinc-500 font-medium">Не удалось получить состояние ноды. Домашний скрипт-мост активен, но локальный демон Chia Full Node выключен или запускается.</p></div>}
          {nodeData && <div className="space-y-6 animate-in fade-in duration-300"><SyncCard nodeData={nodeData} estimatedTimeLeft={estimatedTimeLeft} /><MetricsGrid nodeData={nodeData} blocksPerMinute={blocksPerMinute} totalPeers={nodeData.totalPeers} /><TrafficList peersList={nodeData.peersList} /></div>}
        </div>

        <div className="lg:col-span-5 flex flex-col items-center lg:items-end justify-center w-full">
          <div className="w-full max-w-[340px] space-y-3">
            <div className="flex items-center justify-between w-full px-1"><span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Соединение</span><span className="text-[8px] font-bold text-zinc-500 bg-zinc-900/20 px-2 py-0.5 rounded border border-zinc-900 font-mono">RPC LINK</span></div>
            <div className="w-full bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-4 shadow-2xl relative text-left">
              <div className="flex items-center justify-between h-6 text-[9px] font-black">
                <div className="flex items-center gap-1.5"><span className="text-white">XCH<span className="text-[#FF2E93]">IA</span></span><span className="text-zinc-500 bg-zinc-900/20 px-1 py-0.2 rounded border border-zinc-900 uppercase">{nodeData?.network ?? "TESTNET11"}</span></div>
                <div className="flex items-center gap-1">{isRpcDown ? <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 flex items-center gap-1 border border-red-500/20"><span className="h-1 w-1 rounded-full bg-red-400" />Offline</span> : nodeData?.isConnecting ? <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 flex items-center gap-1 border border-amber-500/20 animate-pulse"><span className="h-1 w-1 rounded-full bg-amber-400 animate-ping" />Connecting</span> : <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1 border border-emerald-500/20"><span className="h-1 w-1 rounded-full bg-emerald-400" />Online</span>}</div>
              </div>
              <p className="text-[10px] font-medium text-zinc-500 mt-3 leading-relaxed">{isRpcDown ? "Узел связи потерял контакт с домашней нодой." : nodeData?.isConnecting ? "Узел активен. Ищем активных пиров в Chia Network для обмена пирами и блоками." : "Связь стабильна. Данные поступают в реальном времени через WebSocket ретранслятор."}</p>
            </div>
          </div>
        </div>
      </div>
      <footer className="w-full text-center text-[10px] text-zinc-600 font-medium py-4 mt-auto border-t border-zinc-900/20"><p>© 2026 xchia.io. Next.js & FastAPI. Разработано для сообщества Chia Network.</p></footer>
    </div>
  )
}
