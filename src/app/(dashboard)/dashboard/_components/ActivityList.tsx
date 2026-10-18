'use client'

import React from "react"
import { ArrowUpRight, ArrowDownLeft, Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { handleApi } from "@/lib/utils"
import { CleanTransaction, formatAddress, formatDate } from "@/app/types/chia"
// Импортируем всё из единого центра типов

interface ActivityListProps {
  currentAddress: string;
}

export function ActivityList({ currentAddress }: ActivityListProps) {
  const { data: transactions = [] } = useQuery<CleanTransaction[]>({
    queryKey: ['walletTransactions', currentAddress],
    queryFn: () => handleApi<CleanTransaction[]>(fetch(`/api/chia/transactions?address=${currentAddress}`)),
    enabled: !!currentAddress,
    refetchInterval: 10000,
    staleTime: 5000,
  })

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
        <Layers size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Последняя активность</span>
      </div>

      <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
        <CardContent className="p-2 space-y-1">
          {transactions.length === 0 ? (
            <div className="p-4 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              История транзакций пуста
            </div>
          ) : (
            transactions.map((tx) => {
              const isIncoming = tx.type === 1
              const formattedAmount = (tx.amount / 1_000_000_000_000).toFixed(4)

              return (
                <div
                  key={tx.name}
                  className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isIncoming ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                      {isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{isIncoming ? "Получено XCH" : "Отправлено XCH"}</p>
                      <p className="text-[10px] font-medium text-zinc-500">{formatAddress(tx.to_address)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black ${isIncoming ? "text-emerald-400" : "text-zinc-200"}`}>
                      {isIncoming ? `+${formattedAmount}` : `-${formattedAmount}`} XCH
                    </p>
                    <p className="text-[9px] font-bold text-zinc-500">{formatDate(tx.confirmed_at_time)}</p>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
