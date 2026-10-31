'use client'

import React, { use, Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { handleApi } from "@/lib/utils"
import { ArrowLeft, Clock, Layers } from "lucide-react"
import Link from "next/link"

interface CoinDetails {
  coinId: string;
  amountXch: string;
  puzzleHash: string;
  parentCoinInfo: string;
  confirmedHeight: number;
  spentHeight: string;
  isSpent: boolean;
}

export default function CoinPage({ params }: { params: Promise<{ network: string; coinId: string }> }) {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white font-sans antialiased p-6 flex justify-center">
      <div className="w-full max-w-md mx-auto space-y-6 pt-4">
        <Suspense fallback={<div className="w-full h-80 bg-zinc-900/20 animate-pulse rounded-[28px]" />}>
          <CoinContent params={params} />
        </Suspense>
      </div>
    </div>
  )
}

function CoinContent({ params }: { params: Promise<{ network: string; coinId: string }> }) {
  const { network, coinId } = use(params)
  const networkName = network.toLowerCase()

  const { data: coin, isLoading, isError } = useQuery<CoinDetails>({
    queryKey: ['coinExplorerDetails', networkName, coinId],
    queryFn: () => handleApi<CoinDetails>(fetch(`/api/explorer/${networkName}/coin/${coinId}`)),
  })

  if (isLoading || !coin) {
    return <div className="text-xs text-zinc-500 animate-pulse text-center pt-40 font-black uppercase tracking-widest">Чтение CoinRecord...</div>
  }

  if (isError) {
    return <div className="text-xs text-[#FF2E93] text-center pt-40 font-black uppercase tracking-widest">Монета не найдена в блокчейне</div>
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* ХЕДЕР */}
      <header className="flex items-center justify-between w-full select-none">
        <Link href={`/explorer/${networkName}`} className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-95">
          <ArrowLeft size={14} />
        </Link>
        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border text-[#FF2E93] bg-[#FF2E93]/5 border-[#FF2E93]/20">
          {networkName}
        </span>
      </header>

      {/* ЗАГОЛОВОК СТРАНИЦЫ */}
      <section className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight text-white leading-none">
          Спецификация <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Монеты</span>
        </h1>
        <p className="text-xs font-semibold text-zinc-400">
          Детальный аудит записи активов Chia Coin (UTXO).
        </p>
      </section>

      {/* СУММА И СТАТУС ТРАТЫ */}
      <div className="w-full bg-zinc-900/40 border border-zinc-900 p-5 rounded-[28px] backdrop-blur-xl shadow-2xl flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Объем записи коина</span>
          <span className="text-2xl font-black text-emerald-400 tracking-tight block">+{coin.amountXch} XCH</span>
        </div>
        <div className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase border tracking-widest ${
          coin.isSpent ? "bg-[#FF2E93]/5 border-[#FF2E93]/20 text-[#FF2E93]" : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
        }`}>
          {coin.isSpent ? "Spent" : "Unspent (UTXO)"}
        </div>
      </div>

      {/* ТЕХНИЧЕСКИЙ КОРПУС ДАННЫХ */}
      <div className="w-full bg-zinc-900/40 border border-zinc-900 p-5 rounded-[28px] backdrop-blur-xl shadow-2xl space-y-4 text-sm">
        
        {/* COIN ID */}
        <div className="border-b border-zinc-900/40 pb-3">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Coin ID (Идентификатор)</span>
          <span className="text-xs font-mono font-black text-zinc-200 block break-all select-all">{coin.coinId}</span>
        </div>

        {/* ХЕШИ ВЛАДЕЛЬЦЕВ */}
        <div className="space-y-3">
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Puzzle Hash (Владелец)</span>
            <span className="text-[10px] font-mono font-bold text-zinc-400 block break-all select-all">{coin.puzzleHash}</span>
          </div>
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Parent Coin Info (Родитель)</span>
            <span className="text-[10px] font-mono font-bold text-zinc-500 block break-all select-all">{coin.parentCoinInfo}</span>
          </div>
        </div>

        {/* ВЫСОТА БЛОКОВ */}
        <div className="grid grid-cols-2 gap-4 border-t border-zinc-900/40 pt-4">
          <Link href={`/explorer/${networkName}/block/${coin.confirmedHeight}`} className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900 hover:border-zinc-800 transition-colors block group">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1"><Layers size={10} /> Блок создания</span>
            <span className="font-mono font-black text-zinc-300 group-hover:text-emerald-400 text-xs transition-colors">#{coin.confirmedHeight}</span>
          </Link>
          <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1"><Clock size={10} /> Блок уничтожения</span>
            <span className="font-mono font-black text-zinc-400 text-xs">{coin.spentHeight}</span>
          </div>
        </div>

      </div>

    </div>
  )
}
