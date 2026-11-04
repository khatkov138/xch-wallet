'use client'

import React, { useState } from "react"
import { ArrowUpRight, ArrowDownLeft, Layers, Clock, CheckCircle2, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { useWalletStatus } from "@/hooks/useWalletStatus"
import { puzzleHashToAddress } from "@/lib/utils/crypto" // 🎯 ИМПОРТИРУЕМ ТВОЮ УТИЛИТУ
import Link from "next/link"

const formatAddressShort = (addr: string) => addr && addr !== "Неизвестный адрес" ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : "Неизвестный адрес"
const formatDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleDateString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "Только что"

// 🎯 Утилита для раскрытия экспоненциальной записи (5.84612e-05 -> 0.0000584612) без лишних нулей
const formatCryptoAmount = (amount: any): string => {
  if (amount === undefined || amount === null) return "0"
  const num = Number(amount)
  if (isNaN(num)) return "0"
  return num.toFixed(12).replace(/\.?0+$/, "")
}

export function ActivityList() {
  const [selectedTx, setSelectedTx] = useState<any>(null)

  // 1. Забираем реактивные транзакции из единого кэша дашборда
  const { transactions, isLoading: isDashboardLoading } = useWalletDashboard()

  // 2. Забираем реальную сеть ноды для префиксов
  const { nodeData } = useWalletStatus()
  const networkName = nodeData?.network || "mainnet"
  const currentPrefix = networkName.toLowerCase().includes("testnet") ? "txch" : "xch"

  // 3. Синхронизированный запрос трекинга статуса транзакции как в Шаге 3
  const { data: txStatus, isLoading: isStatusLoading } = useQuery({
    queryKey: ["track-tx", selectedTx?.tx_id, selectedTx?.parent_coin_info],
    queryFn: async () => {
      if (!selectedTx?.tx_id) return null
      const txId = selectedTx.tx_id
      const targetCoinId = selectedTx.parent_coin_info || txId

      const res = await fetch(`/api/v1/transactions/track-tx?txId=${txId}&targetCoinId=${targetCoinId}`)
      if (!res.ok) throw new Error("Tracker error")
      return res.json()
    },
    enabled: !!selectedTx?.tx_id,
    refetchInterval: (query) => {
      if (query.state.data?.status === "CONFIRMED") return false
      return 6000
    },
    staleTime: 0,
  })

  // Приведение ответа к внутренним переменным стейта
  const blockchainStatus = txStatus?.status || "IN_MEMPOOL"

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
        <Layers size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Последняя активность</span>
      </div>

      <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
        <CardContent className="p-2 space-y-1 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {isDashboardLoading ? (
            <div className="p-4 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-wider animate-pulse">Загрузка истории...</div>
          ) : transactions.length === 0 ? (
            <div className="p-4 text-center text-[10px] font-medium text-zinc-500 uppercase tracking-wider">История транзакций пуста</div>
          ) : (
            transactions.map((tx: any, index: number) => {
              const isIncoming = tx.type === "incoming"

              // 🎯 На лету собираем правильный bech32m адрес из puzzle_hash через твои утилиты
              const rawAddress = puzzleHashToAddress(tx.puzzle_hash, currentPrefix)

              return (
                <div key={`${tx.tx_id || "tx"}_${index}`} onClick={() => setSelectedTx({ ...tx, computedAddress: rawAddress })} className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 rounded-xl transition-colors cursor-pointer active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isIncoming ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                      {isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{isIncoming ? "Получено XCH" : "Отправлено XCH"}</p>
                      <p className="text-[10px] font-medium text-zinc-500">{formatAddressShort(rawAddress)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black ${isIncoming ? "text-emerald-400" : "text-zinc-200"}`}>
                      {isIncoming ? "+" : "-"}{formatCryptoAmount(tx.amount)} XCH
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-[9px] font-bold text-zinc-500">{formatDate(tx.timestamp)}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="bg-zinc-950 border border-zinc-900 text-zinc-100 max-w-sm rounded-[24px] sm:rounded-[24px]">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Детали транзакции</DialogTitle></DialogHeader>
          {selectedTx && (
            <div className="space-y-4 pt-2 text-[11px]">
              <div className="text-center p-4 bg-zinc-900/30 border border-zinc-900/60 rounded-2xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{selectedTx.type === "incoming" ? "Сумма получения" : "Сумма отправки"}</p>
                <p className={`text-2xl font-black ${selectedTx.type === "incoming" ? "text-emerald-400" : "text-white"}`}>
                  {selectedTx.type === "incoming" ? "+" : "-"}{formatCryptoAmount(selectedTx.amount)} XCH
                </p>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-zinc-500 font-medium">Статус ноды:</span>
                {isStatusLoading ? <span className="text-zinc-400 font-bold animate-pulse uppercase text-[10px]">Запрос RPC...</span> :
                  blockchainStatus === "CONFIRMED" ? <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px] uppercase"><CheckCircle2 size={12} /> Подтверждена (#{txStatus?.block_height})</span> :
                    blockchainStatus === "IN_MEMPOOL" ? <span className="text-amber-400 font-bold flex items-center gap-1 text-[10px] uppercase animate-pulse"><Clock size={12} /> В Мемпуле</span> :
                      <span className="text-emerald-500 font-bold flex items-center gap-1 text-[10px] uppercase"><CheckCircle2 size={12} /> В блоке</span>}
              </div>

              <div className="space-y-2 bg-zinc-900/10 p-3 border border-zinc-900/40 rounded-xl">
                <div className="flex justify-between items-start">
                  <span className="text-zinc-500 font-semibold min-w-[70px]">Адрес:</span>
                  <div className="text-right font-mono text-zinc-300 break-all max-w-[200px]">{selectedTx.computedAddress}</div>
                </div>
                <div className="flex justify-between items-center h-5"><span className="text-zinc-500 font-semibold">Время события:</span><span className="text-zinc-300 font-medium">{formatDate(selectedTx.timestamp)}</span></div>
              </div>

              {!isStatusLoading && blockchainStatus === "IN_MEMPOOL" && txStatus?.npc_result && (
                <div className="space-y-1.5 bg-zinc-900/40 p-2.5 border border-zinc-900/60 rounded-xl">
                  <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">NPC Result Conditions (Мемпул):</p>
                  <div className="max-h-[120px] overflow-y-auto font-mono text-[9px] text-zinc-400 space-y-1 scrollbar-thin">
                    {Object.entries(txStatus.npc_result).map(([opcode, condList]: any) => (
                      <div key={opcode} className="border-b border-zinc-900/40 pb-1 last:border-0">
                        <span className="text-amber-400/80 font-bold">Opcode {opcode}:</span>
                        <span className="ml-1 text-zinc-300">{JSON.stringify(condList)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🎯 Кнопка перехода в Explorer */}
              {selectedTx.tx_id && (
                <div className="pt-2 flex justify-center">
                  <Link
                    href={`/explorer/${networkName.toLowerCase()}/coin/${selectedTx.parent_coin_info}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span>Детали монеты в Explorer</span>
                    <ExternalLink size={12} className="text-zinc-500" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
