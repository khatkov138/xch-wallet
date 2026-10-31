'use client'

import React, { use, Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { handleApi } from "@/lib/utils"
import { ArrowLeft, RefreshCw, Disc, Layers, DollarSign, Wallet, Percent, ArrowRight } from "lucide-react"
import Link from "next/link"

interface ExplorerData {
  network: string; blockHeight: number; netspaceFormatted: string; mempoolSize: number;
  chiaPrice: string; marketCap: string; xchFarmed: string;
  latestBlocks: Array<{ height: number; hash: string; isTransaction: boolean; reward: string; fees: string }>;
  latestTransactions: Array<{ id: string; txHash: string; amount: string; toPuzzleHash: string }>;
}

export default function ExplorerPage({ params }: { params: Promise<{ network: string }> }) {
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white font-sans p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-6xl space-y-6">
        <Suspense fallback={<div className="w-full h-80 bg-zinc-900/10 animate-pulse rounded-2xl" />}>
          <ExplorerContent params={params} />
        </Suspense>
      </div>
    </div>
  )
}

function ExplorerContent({ params }: { params: Promise<{ network: string }> }) {
  const networkName = use(params).network.toLowerCase()

  const { data: netData, isFetching } = useQuery<ExplorerData>({
    queryKey: ['chiaUltimateExplorer', networkName],
    queryFn: () => handleApi<ExplorerData>(fetch(`/api/explorer/${networkName}`)),
    refetchInterval: 8000,
  })

  if (!netData) return <div className="text-center pt-40 text-xs text-zinc-500 animate-pulse uppercase font-black">Загрузка...</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex items-center justify-between w-full border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white"><ArrowLeft size={14} /></Link>
          <div><h1 className="text-xl font-black text-white">XCHA Analytics</h1><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Global Explorer</span></div>
        </div>
        <div className="flex items-center gap-3">{isFetching && <RefreshCw size={12} className="text-[#FF2E93] animate-spin" />}<span className="text-[9px] font-black uppercase px-3 py-1 rounded-xl border border-[#FF2E93]/20 text-[#FF2E93] bg-[#FF2E93]/5">{networkName}</span></div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <div className="bg-zinc-900/30 border border-zinc-900 p-4.5 rounded-2xl flex items-center justify-between"><div><span className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Chia Price / Cap</span><span className="text-lg font-black text-white">{netData.chiaPrice}</span><span className="text-[10px] font-bold text-zinc-400 font-mono block">Cap: {netData.marketCap}</span></div><DollarSign size={16} className="text-zinc-600" /></div>
        <div className="bg-zinc-900/30 border border-zinc-900 p-4.5 rounded-2xl flex items-center justify-between"><div><span className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Текущий блок</span><span className="text-lg font-black text-zinc-200 font-mono">#{netData.blockHeight.toLocaleString()}</span><span className="text-[10px] font-bold text-[#FF2E93] font-mono block">{netData.mempoolSize} tx в мемпуле</span></div><Layers size={16} className="text-zinc-600" /></div>
        <div className="bg-zinc-900/30 border border-zinc-900 p-4.5 rounded-2xl flex items-center justify-between"><div><span className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">XCH Farmed</span><span className="text-lg font-black text-zinc-200">{netData.xchFarmed}</span><span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Circulation</span></div><Wallet size={16} className="text-zinc-600" /></div>
        <div className="bg-zinc-900/40 border border-zinc-900 p-4.5 rounded-2xl flex items-center justify-between"><div><span className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Net Space</span><span className="text-lg font-black text-emerald-400">{netData.netspaceFormatted}</span><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Total Weight</span></div><Disc size={16} className="text-emerald-500 animate-spin" /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <div className="space-y-3">
          <div className="border-b border-zinc-900 pb-2"><h2 className="text-[11px] font-black uppercase text-zinc-400 flex items-center gap-2"><Layers size={12} className="text-[#FF2E93]" /> Latest Blocks</h2></div>
          <div className="space-y-2">
            {netData.latestBlocks?.map((block) => (
              <Link href={`/explorer/${networkName}/block/${block.height}`} key={block.height} className="bg-zinc-900/10 border border-zinc-900/60 p-4 rounded-xl flex items-center justify-between hover:border-[#FF2E93]/40 transition-all group block cursor-pointer">
                <div className="space-y-1 min-w-0 flex-1 pr-3"><div className="flex items-center gap-2"><span className="font-mono font-black text-zinc-200 group-hover:text-[#FF2E93] text-sm">#{block.height}</span>{block.isTransaction && <span className="text-[7px] font-extrabold bg-[#FF2E93]/10 text-[#FF2E93] border border-[#FF2E93]/20 px-1.5 py-0.5 rounded">TX</span>}</div><span className="text-[9px] font-mono text-zinc-600 block truncate w-full">{block.hash}</span></div>
                <div className="text-right flex-shrink-0"><span className="font-black text-zinc-300 block text-xs">{block.reward} XCH</span><span className="text-[9px] text-zinc-500 block font-mono">Fee: {block.fees}</span></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="border-b border-zinc-900 pb-2"><h2 className="text-[11px] font-black uppercase text-zinc-400 flex items-center gap-2"><Percent size={12} className="text-emerald-400" /> Latest Transactions</h2></div>
          <div className="space-y-2">
            {netData.latestTransactions?.map((tx) => (
              <Link href={`/explorer/${networkName}/coin/${tx.id}`} key={tx.id} className="bg-zinc-900/10 border border-zinc-900/60 p-4 rounded-xl flex items-center justify-between hover:border-emerald-500/40 transition-all group block cursor-pointer">
                <div className="space-y-1 min-w-0 flex-1 pr-3"><span className="text-[10px] font-bold text-zinc-400 block truncate font-mono">Hash: {tx.txHash}</span><div className="flex items-center gap-1 text-[9px] text-zinc-600 font-mono"><span>To:</span><span className="truncate block w-full text-zinc-500">{tx.toPuzzleHash}</span></div></div>
                <div className="text-right flex-shrink-0 flex items-center gap-2"><div><span className="font-black text-emerald-400 block text-xs">+{tx.amount} XCH</span><span className="text-[8px] text-zinc-500 uppercase block font-bold">Farmer Reward</span></div><ArrowRight size={12} className="text-zinc-700 group-hover:text-emerald-400 transition-colors" /></div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
