'use client'

import React, { Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, Clock, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { usePuzzleHashToAddress } from "@/hooks/usePuzzleHashToAddress"

const formatMojoToXch = (mojo: any): string => {
  if (!mojo) return "0"
  const xch = Number(mojo) / 1000000000000
  return xch.toFixed(12).replace(/\.?0+$/, "")
}

const formatDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleString("ru-RU") : "—"

function CoinExplorerContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const network = (params?.network as string) || "mainnet"
  const coinId = (params?.coinId as string) || ""
  const txIdParam = searchParams.get("txId") || ""
  const finalTxId = txIdParam || coinId

  const { data: txData, isLoading, isError } = useQuery({
    queryKey: ["explorer-coin", coinId, finalTxId, network],
    queryFn: async () => {
      if (!coinId) return null
      const res = await fetch(`/api/v1/transactions/track-tx?txId=${finalTxId}&targetCoinId=${coinId}`)
      if (!res.ok) throw new Error("Tracker RPC Error")
      return res.json()
    },
    enabled: !!coinId,
    refetchInterval: (query) => query.state.data?.status === "CONFIRMED" ? false : 6000,
    staleTime: 0,
  })

  const blockchainStatus = txData?.status || "NOT_FOUND"
  const isConfirmed = blockchainStatus === "CONFIRMED"

  const computedToAddress = usePuzzleHashToAddress(txData?.puzzle_hash)
  const computedFromAddress = usePuzzleHashToAddress(txData?.parent_puzzle_hash)
  const displayTxId = txData?.tx_id && txData.tx_id !== coinId && txData.tx_id !== `0x${coinId}`

  const handleAddressClick = (address: string) => {
    if (!address || address.includes("Reward") || address.includes("Ожидание")) return
    router.push(`/explorer/${network}/address/${address}`)
  }

  return (
    <div className="space-y-5">
      <button 
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-semibold bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-900 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
      >
        <ChevronLeft size={14} />
        <span>Вернуться в кошелек</span>
      </button>

      <div className="space-y-1">
        <span className="text-[10px] font-bold text-[#FF2E93] uppercase tracking-widest bg-[#FF2E93]/10 px-2 py-0.5 rounded-md border border-[#FF2E93]/20">
          Chia Coin Explorer ({network.toUpperCase()})
        </span>
        <h1 className="text-xl font-black text-white tracking-tight break-all pt-1">
          Coin Overview
        </h1>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider animate-pulse">
          Загрузка спецификации монеты...
        </div>
      ) : isError || txData?.success === false ? (
        <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] p-6 text-center">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Монета не найдена</p>
        </Card>
      ) : (
        <div className="space-y-4">
          
          <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border shrink-0 ${
                  isConfirmed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}>
                  {isConfirmed ? <ShieldCheck size={20} /> : <Clock size={20} className="animate-spin" style={{ animationDuration: '4s' }} />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">
                    {isConfirmed ? "Статус: Подтверждена (Coin Created)" : "Статус: В Мемпуле"}
                  </h3>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    {isConfirmed ? "Запись успешно внесена в глобальный стейт Chia" : "Транзакция ожидает включения в блок"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-zinc-900/10 border border-zinc-900/50 rounded-[24px] p-5 space-y-3.5 text-[11px]">
            
            {displayTxId && (
              <div className="flex justify-between items-center py-2 border-b border-zinc-900/60">
                <span className="text-zinc-500 font-semibold">Transaction ID:</span>
                <span className="font-mono text-zinc-300 break-all max-w-[240px] text-right select-all">{txData.tx_id}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-2 border-b border-zinc-900/60">
              <span className="text-zinc-500 font-semibold">Coin ID (Name):</span>
              <span className="font-mono text-[#FF2E93] break-all max-w-[240px] text-right select-all">{coinId}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-zinc-900/60">
              <span className="text-zinc-500 font-semibold">Amount:</span>
              <span className="font-black text-white text-right text-xs">
                {isConfirmed ? `${formatMojoToXch(txData.amount_mojo)} XCH` : "Расчет суммы..."}
              </span>
            </div>

            <div className="flex justify-between items-start py-2 border-b border-zinc-900/60 gap-4">
              <span className="text-zinc-500 font-semibold">From (Sender Address):</span>
              <div className="text-right max-w-[240px]">
                {isConfirmed ? (
                  computedFromAddress ? (
                    <button
                      onClick={() => handleAddressClick(computedFromAddress)}
                      className="font-mono text-zinc-300 break-all text-right hover:text-[#FF2E93] transition-colors select-none cursor-pointer block w-full text-right"
                    >
                      {computedFromAddress}
                    </button>
                  ) : (
                    <span className="font-mono text-zinc-500 italic select-none">Pool / Remint Reward</span>
                  )
                ) : (
                  <span className="font-mono text-zinc-500 select-none block">Ожидание блока...</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-start py-2 border-b border-zinc-900/60 gap-4">
              <span className="text-zinc-500 font-semibold">To (Recipient Address):</span>
              <div className="text-right max-w-[240px]">
                {isConfirmed && computedToAddress ? (
                  <button
                    onClick={() => handleAddressClick(computedToAddress)}
                    className="font-mono text-emerald-400 break-all text-right hover:text-[#FF2E93] transition-colors select-none cursor-pointer block w-full text-right"
                  >
                    {computedToAddress}
                  </button>
                ) : (
                  <span className="font-mono text-zinc-500 select-none block">Определяется...</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-zinc-900/60">
              <span className="text-zinc-500 font-semibold">Time (UTC):</span>
              <span className="text-zinc-300 font-medium text-right">
                {isConfirmed ? formatDate(txData.timestamp) : "В процессе..."}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-500 font-semibold">Confirmed Block:</span>
              <span className="font-mono font-bold text-zinc-300 text-right">
                {isConfirmed ? `#${txData.block_height}` : "—"}
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default function CoinExplorerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-medium text-zinc-500 animate-pulse">Загрузка эксплорера...</div>}>
      <CoinExplorerContent />
    </Suspense>
  )
}
