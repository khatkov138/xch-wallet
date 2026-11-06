'use client'

import React, { use } from "react"
import { useQuery } from "@tanstack/react-query"
import { Clock, ShieldCheck, HelpCircle } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { puzzleHashToAddress } from "@/lib/utils/crypto"

const formatMojoToXch = (mojo: any): string => {
  if (!mojo) return "0"
  const xch = Number(mojo) / 1000000000000
  return xch.toFixed(12).replace(/\.?0+$/, "")
}

const formatDate = (ts: number) => (ts ? new Date(ts * 1000).toLocaleString("ru-RU") : "—")

interface CoinExplorerClientProps {
  dataPromise: Promise<any>
  paramsPromise: Promise<{ lang: string; network: string; coinId: string }>
}

export function CoinExplorerClient({ dataPromise, paramsPromise }: CoinExplorerClientProps) {
  // Нативно разворачиваем промисы из сервера на клиенте без побочных эффектов
  const initialTxData = use(dataPromise)
  const params = use(paramsPromise)
console.log(initialTxData)
  const network = params?.network || "mainnet"
  const coinId = params?.coinId || ""
  const lang = params?.lang || "ru"

  // Живой поллинг мемпула через TanStack Query
  const { data: txData } = useQuery({
    queryKey: ["explorer-coin", coinId, network],
    queryFn: async () => {
      const finalTxId = initialTxData?.tx_id || coinId
      const res = await fetch(`/api/v1/transactions/track-tx?txId=${finalTxId}&targetCoinId=${coinId}&network=${network}`)
      if (!res.ok) throw new Error("Tracker RPC Error")
      return res.json()
    },
    initialData: initialTxData, // Мгновенный первый кадр SSR
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status || "IN_MEMPOOL"
      if (currentStatus === "CONFIRMED") return false 
      return 10000 // 10 секунд
    },
    staleTime: 60000,
    gcTime: 0,
  })

  // Резервный селектор на случай перезагрузки стейтов
  const activeData = txData || initialTxData

  if (!activeData) {
    return (
      <div className="bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-8 text-center min-h-[220px] flex items-center justify-center w-full">
        <p className="text-zinc-500 font-bold uppercase tracking-wider text-xs">Загрузка сетевых узлов...</p>
      </div>
    )
  }

  const blockchainStatus = activeData?.status || "NOT_FOUND"
  const isMempool = blockchainStatus === "IN_MEMPOOL"
  const isConfirmed = blockchainStatus === "CONFIRMED"

  if (activeData.success === false && !isMempool) {
    return (
      <div className="bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-8 text-center min-h-[220px] flex items-center justify-center w-full">
        <p className="text-zinc-500 font-bold uppercase tracking-wider text-xs">Монета не найдена в ноде {network.toUpperCase()}</p>
      </div>
    )
  }

  const computedToAddress = activeData?.puzzle_hash ? puzzleHashToAddress(activeData.puzzle_hash, network) : null
  const computedFromAddress = activeData?.parent_puzzle_hash ? puzzleHashToAddress(activeData.parent_puzzle_hash, network) : null

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-200 text-left">
      
      {/* Шапка статуса */}
      <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border shrink-0 ${
              isConfirmed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            }`}>
              {isConfirmed ? (
                <ShieldCheck size={20} />
              ) : (
                <Clock size={20} className="animate-spin text-blue-400" style={{ animationDuration: '4s' }} />
              )}
            </div>
            <div>
              <h3 className="text-xs font-black text-white">
                {isConfirmed ? "Статус: Подтверждена" : "Статус: В Мемпуле"}
              </h3>
              <p className="text-[11px] text-zinc-400 leading-normal mt-0.5">
                {isConfirmed ? "Запись внесена в блокчейн Chia" : "Транзакция ожидает подтверждения"}
              </p>
            </div>
          </div>
          
          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider shrink-0 ${
            isConfirmed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
          }`}>
            <span className={`inline-block h-1 w-1 rounded-full mr-1.5 animate-pulse ${isConfirmed ? "bg-emerald-400" : "bg-blue-400"}`} />
            {isConfirmed ? "Confirmed" : "In mempool"}
          </span>
        </CardContent>
      </Card>

      {/* Инвойс параметров */}
      <div className="bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-5 space-y-3.5 text-[11px]">
        
        <div className="flex flex-col py-1 border-b border-zinc-900/60 gap-1">
          <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Transaction ID</span>
          <span className="font-mono text-zinc-300 break-all select-all font-medium">{activeData.tx_id}</span>
        </div>

        <div className="flex flex-col py-1 border-b border-zinc-900/60 gap-1">
          <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Coin ID (Name)</span>
          <span className="font-mono text-[#FF2E93] break-all select-all font-medium">{coinId}</span>
        </div>

        {!isConfirmed ? (
          <div className="p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-2.5 text-zinc-400 leading-relaxed text-[11px] mt-1">
            <HelpCircle size={15} className="text-blue-400 shrink-0 mt-0.5 animate-pulse" />
            <span>
              Сумма перевода и адреса участников извлекаются в фоне из мемпула ноды. Данные откроются автоматически сразу после валидации блока. Движок кошелька отслеживает статус автоматически каждые 10 секунд.
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Сумма перевода</span>
              <span className="font-black text-emerald-400 text-xs font-mono">{formatMojoToXch(activeData.amount_mojo)} XCH</span>
            </div>

            <div className="flex flex-col py-1 border-b border-zinc-900/60 gap-1">
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Отправитель (From)</span>
              {computedFromAddress ? (
                <Link
                  href={`/${lang}/explorer/${network}/address/${computedFromAddress}`}
                  className="font-mono text-zinc-300 break-all hover:text-[#FF2E93] transition-colors block text-left"
                >
                  {computedFromAddress}
                </Link>
              ) : (
                <span className="font-mono text-zinc-500 italic select-none">Pool / Remint Reward</span>
              )}
            </div>

            <div className="flex flex-col py-1 border-b border-zinc-900/60 gap-1">
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Получатель (To)</span>
              <Link
                href={`/${lang}/explorer/${network}/address/${computedToAddress}`}
                className="font-mono text-emerald-400 break-all hover:text-[#FF2E93] transition-colors block text-left"
              >
                {computedToAddress}
              </Link>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Время блока (UTC)</span>
              <span className="text-zinc-300 font-medium font-mono">{formatDate(activeData.timestamp)}</span>
            </div>

            <div className="flex justify-between items-center pt-0.5">
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Высота блока</span>
              <span className="font-mono text-zinc-300">#{activeData.block_height}</span>
            </div>
          </>
        )}

      </div>

    </div>
  )
}
