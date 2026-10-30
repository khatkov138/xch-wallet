'use client'

import React from "react"
import { ArrowUpRight, ArrowDownLeft, Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore" // Подключаем сессию вместо старого хука
import { CleanTransaction, formatAddress, formatDate } from "@/app/types/chia"

export function ActivityList() {
  // 1. Моментально забираем публичный ключ из активной сессии Zustand
  const { unhardenedPkHex } = useWalletSession()

  // 2. Запрашиваем историю транзакций по реальному unhardenedPkHex
  const { data: transactions = [], isLoading } = useQuery<CleanTransaction[]>({
    queryKey: ['walletTransactions', unhardenedPkHex],
    queryFn: async () => {
      const res = await fetch(`http://localhost:8000/api/wallet/transactions?publicKeyHex=${unhardenedPkHex}&limit=200`);
      if (!res.ok) throw new Error("Ошибка загрузки истории");
      return res.json();
    },
    // Запрос пойдет только если юзер залогинен и ключ есть в оперативке
    enabled: !!unhardenedPkHex,
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
        <CardContent className="p-2 space-y-1 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {isLoading ? (
            /* Красивое состояние загрузки пока тащим транзакции */
            <div className="p-4 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-wider animate-pulse">
              Загрузка истории...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-4 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              История транзакций пуста
            </div>
          ) : (
            transactions.map((tx, index) => {
              const isIncoming = tx.type === 1
              const formattedAmount = tx.amount

              const uniqueKey = `${tx.name || 'tx'}_${tx.type}_${index}_${tx.confirmed_at_time}`;

              return (
                <div
                  key={uniqueKey}
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
