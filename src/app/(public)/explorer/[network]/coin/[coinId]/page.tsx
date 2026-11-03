'use client'

import React, { Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, Clock, ShieldCheck, Box } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

// Суб-компонент, изолированный внутри Suspense-границы
function CoinExplorerContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const network = (params?.network as string) || "mainnet"
  const coinId = (params?.coinId as string) || ""
  
  // Временный txId берем из query, если транзакция еще летит в мемпуле
  const txId = searchParams.get("txId") || coinId

  // Атомарный поллинг FastAPI-бэкенда строго по твоему Python-контракту
  const { data: txData, isLoading, isError } = useQuery({
    queryKey: ["explorer-coin", coinId, txId, network],
    queryFn: async () => {
      if (!coinId) return null
      const res = await fetch(`/api/v1/transactions/track-tx?txId=${txId}&targetCoinId=${coinId}`)
      if (!res.ok) throw new Error("Tracker RPC Error")
      return res.json()
    },
    enabled: !!coinId,
    refetchInterval: (query) => query.state.data?.status === "CONFIRMED" ? false : 6000,
    staleTime: 0,
  })

  const blockchainStatus = txData?.status || "NOT_FOUND"
  const isConfirmed = blockchainStatus === "CONFIRMED"

  return (
    <div className="space-y-5">
      {/* Кнопка возврата в дашборд кошелька */}
      <button 
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-semibold bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-900 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
      >
        <ChevronLeft size={14} />
        <span>Вернуться в кошелек</span>
      </button>

      {/* Заголовок */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-[#FF2E93] uppercase tracking-widest bg-[#FF2E93]/10 px-2 py-0.5 rounded-md border border-[#FF2E93]/20">
          Chia Coin Explorer ({network.toUpperCase()})
        </span>
        <h1 className="text-xl font-black text-white tracking-tight break-all pt-1">
          Монета #{coinId.slice(0, 12)}...
        </h1>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider animate-pulse">
          Поиск монеты в сети Chia...
        </div>
      ) : isError || txData?.success === false ? (
        <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] p-6 text-center">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Монета не найдена в блокчейне</p>
        </Card>
      ) : (
        <div className="space-y-4">
          
          {/* Блок статуса */}
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
                    {isConfirmed ? "Статус: Подтверждена" : "Статус: В Мемпуле (Ожидание)"}
                  </h3>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    {isConfirmed 
                      ? "Монета успешно создана и записана в реестр" 
                      : "Транзакция по созданию монеты находится в очереди"}
                  </p>
                </div>
              </div>
              
              {isConfirmed && txData?.block_height && (
                <div className="text-right">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider">Высота записи</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">#{txData.block_height}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Параметры монеты */}
          <div className="bg-zinc-900/10 border border-zinc-900/50 rounded-[24px] p-5 space-y-3.5">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Box size={13} />
              <span>Спецификация Coin Record</span>
            </h3>

            <div className="space-y-2.5 text-[11px] font-medium">
              <div className="flex justify-between items-start gap-4 py-1.5 border-b border-zinc-900/40">
                <span className="text-zinc-500 min-w-[120px]">Coin ID (Name):</span>
                <span className="font-mono text-zinc-300 break-all text-right select-all">{coinId}</span>
              </div>

              {searchParams.get("txId") && (
                <div className="flex justify-between items-start gap-4 py-1.5">
                  <span className="text-zinc-500 min-w-[120px]">Мемпул Tx ID:</span>
                  <span className="font-mono text-zinc-400 break-all text-right select-all">{searchParams.get("txId")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Экспортируем корневой компонент страницы, обернутый в Suspense
export default function CoinExplorerPage() {
  return (
    <Suspense 
      fallback={
        <div className="p-8 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider animate-pulse">
          Загрузка окружения Next.js 16...
        </div>
      }
    >
      <CoinExplorerContent />
    </Suspense>
  )
}
