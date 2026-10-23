'use client'

import React, { use, Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { handleApi } from "@/lib/utils"
import { ArrowLeft, Clock } from "lucide-react"
import Link from "next/link"

interface BlockDetails {
  height: number;
  hash: string;
  prevHash: string;
  weight: string;
  totalTransactions: string;
  farmerPuzzleHash: string;
  poolPuzzleHash: string;
  timestamp: number | null;
  rewardXch: string;
  feesXch: string;
}

export default function BlockPage({ params }: { params: Promise<{ network: string; height: string }> }) {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white font-sans antialiased p-6 flex justify-center">
      <div className="w-full max-w-md mx-auto space-y-6 pt-4">
        <Suspense fallback={<div className="w-full h-80 bg-zinc-900/20 animate-pulse rounded-[28px]" />}>
          <BlockContent params={params} />
        </Suspense>
      </div>
    </div>
  )
}

function BlockContent({ params }: { params: Promise<{ network: string; height: string }> }) {
  const { network, height } = use(params)
  const networkName = network.toLowerCase()

  const { data: block, isLoading } = useQuery<BlockDetails>({
    queryKey: ['blockExplorerDetails', networkName, height],
    queryFn: () => handleApi<BlockDetails>(fetch(`/api/explorer/${networkName}/block/${height}`)),
  })

  if (isLoading || !block) {
    return <div className="text-xs text-zinc-500 animate-pulse text-center pt-40 font-black uppercase tracking-widest">Запрос к Full Node...</div>
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* ХЕДЕР — Кнопка назад */}
      <header className="flex items-center justify-between w-full select-none">
        <Link href={`/explorer/${networkName}`} className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-95">
          <ArrowLeft size={14} />
        </Link>
        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border text-[#FF2E93] bg-[#FF2E93]/5 border-[#FF2E93]/20">
          {networkName}
        </span>
      </header>

      {/* ЗАГОЛОВОК С НОМЕРОМ БЛОКА */}
      <section className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight text-white leading-none">
          Блок <span className="bg-gradient-to-r from-[#FF2E93] to-[#B82EFF] bg-clip-text text-transparent">#{block.height.toLocaleString('ru-RU')}</span>
        </h1>
        <p className="text-xs font-semibold text-zinc-400">
          Техническая и финансовая спецификация записи Chia.
        </p>
      </section>

      {/* КОРПУС ДАННЫХ */}
      <div className="w-full bg-zinc-900/40 border border-zinc-900 p-5 rounded-[28px] backdrop-blur-xl shadow-2xl space-y-4 text-sm">
        
        {/* ХЕШ БЛОКА */}
        <div className="border-b border-zinc-900/80 pb-3">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Header Hash</span>
          <span className="text-xs font-mono font-black text-[#FF2E93] block break-all select-all">{block.hash}</span>
        </div>

        {/* ФИНАНСОВАЯ СЕТКА ПАРАМЕТРОВ (XCH И FEE) */}
        <div className="grid grid-cols-2 gap-4 border-b border-zinc-900/40 pb-4">
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase block">Награда блока</span>
            <span className="font-black text-emerald-400 text-sm block mt-0.5">{block.rewardXch} XCH</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase block">Комиссия (Fees)</span>
            <span className="font-mono font-black text-zinc-200 text-xs block mt-0.5">{block.feesXch} XCH</span>
          </div>
        </div>

        {/* ТЕХНИЧЕСКАЯ СЕТКА ПАРАМЕТРОВ */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase block">Тип записи</span>
            <span className="font-black text-zinc-300 text-xs block mt-0.5">{block.totalTransactions}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase block">Вес сложности</span>
            <span className="font-mono font-black text-zinc-400 text-xs block mt-0.5">{Number(block.weight).toLocaleString('ru-RU')}</span>
          </div>
        </div>

        {/* ПУЛ И ФЕРМЕР АДРЕСА */}
        <div className="border-t border-zinc-900/80 pt-3 space-y-3">
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Farmer Reward Puzzle Hash</span>
            <span className="text-[10px] font-mono font-bold text-zinc-400 block break-all select-all">{block.farmerPuzzleHash}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Pool Target Puzzle Hash</span>
            <span className="text-[10px] font-mono font-bold text-zinc-400 block break-all select-all">{block.poolPuzzleHash}</span>
          </div>
          <div className="border-t border-zinc-900/80 pt-3">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Previous Block Hash</span>
            <span className="text-[10px] font-mono text-zinc-600 block break-all">{block.prevHash}</span>
          </div>
        </div>

        {/* ВРЕМЯ СОЗДАНИЯ */}
        <div className="border-t border-zinc-900/80 pt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <span className="flex items-center gap-1.5"><Clock size={11} /> Время генерации</span>
          <span className="text-zinc-300 font-mono">
            {block.timestamp ? new Date(block.timestamp * 1000).toLocaleString('ru-RU') : "Служебный сигнал сети"}
          </span>
        </div>

      </div>

    </div>
  )
}
