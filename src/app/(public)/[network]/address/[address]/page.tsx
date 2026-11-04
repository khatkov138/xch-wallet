'use client'

import React, { Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, Wallet, ArrowUpRight, ArrowDownLeft, Layers, Box, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

// 🎯 Утилита для раскрытия экспоненциальной записи без лишних нулей
const formatCryptoAmount = (amount: any): string => {
  if (amount === undefined || amount === null) return "0"
  const num = Number(amount)
  if (isNaN(num)) return "0"
  return num.toFixed(12).replace(/\.?0+$/, "")
}

const formatMojoToXch = (mojo: any): string => {
  if (!mojo) return "0"
  return formatCryptoAmount(Number(mojo) / 1000000000000)
}

const formatDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleDateString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "Только что"

function AddressExplorerContent() {
  const params = useParams()
  const router = useRouter()
  
  const network = (params?.network as string) || "mainnet"
  const address = (params?.address as string) || ""

  const { data: addrData, isLoading, isError } = useQuery({
    queryKey: ["explorer-address", address, network],
    queryFn: async () => {
      if (!address) return null
      const res = await fetch(`/api/v1/addresses/track-address?puzzleHash=${address}&includeSpent=true`)
      if (!res.ok) throw new Error("Address RPC Error")
      return res.json()
    },
    enabled: !!address,
    refetchInterval: 10000,
    staleTime: 5000,
  })

  if (isLoading) return <div className="p-8 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider animate-pulse">Загрузка спецификации адреса...</div>
  if (isError || addrData?.success === false) {
    return (
      <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] p-6 text-center">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Адрес не найден или неактивен</p>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Link 
        href="/"
        className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-semibold bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-900 px-3 py-1.5 rounded-xl transition-all cursor-pointer select-none"
      >
        <ChevronLeft size={14} />
        <span>Вернуться в кошелек</span>
      </Link>

      <div className="space-y-1">
        <span className="text-[10px] font-bold text-[#FF2E93] uppercase tracking-widest bg-[#FF2E93]/10 px-2 py-0.5 rounded-md border border-[#FF2E93]/20">
          Chia Address Explorer ({network.toUpperCase()})
        </span>
        <h1 className="text-xl font-black text-white tracking-tight break-all pt-1 select-none">
          Address Overview
        </h1>
        <p className="text-[11px] font-mono text-zinc-500 break-all pt-1 select-all">{address}</p>
      </div>

      {/* 💳 Сетка Балансов аналогично Spacescan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl border shrink-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Balance</h3>
              <p className="text-lg font-black text-white tracking-tight pt-0.5">
                {formatMojoToXch(addrData?.confirmed_balance_mojo)} <span className="text-xs font-medium text-zinc-400">XCH</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl border shrink-0 bg-[#FF2E93]/10 text-[#FF2E93] border-[#FF2E93]/20">
              <Box size={20} />
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Coins Tracked</h3>
              <p className="text-lg font-black text-white tracking-tight pt-0.5">
                {addrData?.total_coins_tracked || 0} <span className="text-xs font-medium text-zinc-400">UTXO</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 📋 Список транзакций / Coin Records */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
          <Layers size={12} />
          <span className="text-[10px] font-bold uppercase tracking-wider">История транзакций</span>
        </div>

        <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
          <CardContent className="p-2 space-y-1 max-h-[440px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {addrData?.coin_records?.length === 0 ? (
              <div className="p-4 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-wider">История транзакций пуста</div>
            ) : (
              addrData?.coin_records?.map((coin: any, index: number) => {
                const cleanCoinId = coin.coin_id ? coin.coin_id.replace("0x", "") : ""
                const reactKey = cleanCoinId ? `coin-${cleanCoinId}` : `fallback-${coin.confirmed_block}-${index}`
                const isIncoming = !coin.is_spent

                return (
                  <Link
                    key={reactKey}
                    href={cleanCoinId ? `/explorer/${network}/coin/${cleanCoinId}` : "#"}
                    className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 rounded-xl transition-colors active:scale-[0.99] group/item"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-lg border shrink-0 flex items-center justify-center ${
                        isIncoming ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-zinc-800 text-zinc-400 border-zinc-700/50"
                      }`}>
                        {isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white group-hover/item:underline inline-flex items-center gap-1">
                          <span>{isIncoming ? "Получено XCH" : "Потрачено / Отправлено"}</span>
                          <ExternalLink size={10} className="opacity-0 group-hover/item:opacity-100 transition-opacity text-zinc-500" />
                        </p>
                        <p className="font-mono text-[10px] text-zinc-500 truncate max-w-[160px] md:max-w-[280px]">
                          {coin.coin_id || "Gen / Block Reward"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`text-xs font-black ${isIncoming ? "text-emerald-400" : "text-zinc-400"}`}>
                        {isIncoming ? "+" : "-"}{formatMojoToXch(coin.amount_mojo)} XCH
                      </p>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5 text-[9px] text-zinc-500 font-bold">
                        <Box size={10} />
                        <span>#{coin.is_spent ? coin.spent_block : coin.confirmed_block}</span>
                        <span>•</span>
                        <span>{formatDate(coin.timestamp)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AddressExplorerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-medium text-zinc-500 animate-pulse">Загрузка эксплорера адреса...</div>}>
      <AddressExplorerContent />
    </Suspense>
  )
}
