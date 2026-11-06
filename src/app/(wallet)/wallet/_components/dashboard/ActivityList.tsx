'use client'

import React, { useState } from "react"
import { ArrowUpRight, ArrowDownLeft, Layers, Clock, CheckCircle2, ExternalLink, Copy, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"
import { puzzleHashToAddress } from "@/lib/utils/crypto"

const fmtAddr = (a: string) => a && a !== "Неизвестный адрес" ? `${a.slice(0, 6)}...${a.slice(-6)}` : "Неизвестный адрес"
const fmtDate = (ts: number, p: boolean) => p ? "Только что" : (ts ? new Date(ts * 1000).toLocaleDateString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "Только что")

export function ActivityList() {
  const [selectedTx, setSelectedTx] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const { transactions, isLoading: isDashLoading } = useWalletDashboard()
  
  // 🌟 Достаем настройки сети и ЯЗЫКА напрямую из Zustand провайдера юзера
  const network = useUserSettingsStore((state: any) => state.network)
  const language = useUserSettingsStore((state: any) => state.language) ?? "ru"
  
  const currentPrefix = network.toLowerCase().includes("testnet") ? "txch" : "xch"

  const { data: txStatus } = useQuery({
    queryKey: ["track-tx", selectedTx?.tx_id, selectedTx?.parent_coin_info, network],
    queryFn: async () => {
      const res = await fetch(`/api/v1/transactions/track-tx?txId=${selectedTx.tx_id}&targetCoinId=${selectedTx.parent_coin_info || selectedTx.tx_id}&network=${network}`)
      return res.ok ? res.json() : null
    },
    enabled: !!selectedTx?.tx_id,
    refetchInterval: (q) => q.state.data?.status === "CONFIRMED" ? false : 6000,
  })

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // Вычисляем чистый ID монеты и формируем URL С УЧЕТОМ ТЕКУЩЕЙ ЛОКАЛИ РОУТИНГА
  const baseCoinId = selectedTx?.tx_id ? selectedTx.tx_id.split('_ch') : ""
  const targetCoinId = selectedTx?.created_coin_id || baseCoinId || ""
  
  // 🚀 Прошиваем префикс языка в самое начало пути URL-адреса!
  const cleanLang = String(language).toLowerCase().trim()
  const explorerUrl = `/${cleanLang}/explorer/${network.toLowerCase()}/coin/${targetCoinId}?txId=${selectedTx?.tx_id || ""}`

  return (
    <div className="space-y-2.5 font-mono">
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
        <Layers size={12} /> <span>Последняя активность</span>
      </div>
      <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
        <CardContent className="p-2 space-y-1 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {isDashLoading ? ( <div className="p-4 text-center text-[10px] text-zinc-500 uppercase tracking-wider animate-pulse">Загрузка...</div> ) : transactions.length === 0 ? ( <div className="p-4 text-center text-[10px] text-zinc-500 uppercase tracking-wider">История пуста</div> ) : (
            transactions.map((tx: any, idx: number) => {
              const isIn = tx.type === "incoming", isPend = tx.status !== "confirmed"
              const curPh = String(tx.puzzle_hash ?? "").trim().toLowerCase()
              const rawAddr = curPh.startsWith("xch1") || curPh.startsWith("txch1") ? tx.puzzle_hash : puzzleHashToAddress(tx.puzzle_hash, currentPrefix)
              return (
                <div key={idx} onClick={() => setSelectedTx({ ...tx, computedAddress: rawAddr, isPend })} className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 rounded-xl transition-colors cursor-pointer active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${isPend ? (isIn ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-800/80 text-zinc-400 border-zinc-700/30") : (isIn ? "bg-emerald-500/15 text-emerald-400 border-transparent" : "bg-zinc-800 text-zinc-400 border-transparent")}`}>
                      {isPend ? <Clock size={15} className={isIn ? "animate-pulse" : ""} /> : isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isPend && !isIn ? "text-zinc-400" : "text-white"}`}>{isIn ? "Получено XCH" : "Отправлено XCH"}</p>
                      <p className="text-[10px] font-medium text-zinc-500">{fmtAddr(rawAddr)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black ${isPend && !isIn ? "text-zinc-400" : isIn ? "text-emerald-400" : "text-zinc-200"}`}>{isIn ? "+" : "-"}{tx.amount} XCH</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className={`h-1 w-1 rounded-full ${isPend ? (isIn ? "bg-emerald-400" : "bg-zinc-500") + " animate-pulse" : "bg-emerald-500"}`} />
                      <p className="text-[9px] font-bold text-zinc-500">{fmtDate(tx.timestamp, isPend)}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
      <Dialog open={!!selectedTx} onOpenChange={(o) => !o && setSelectedTx(null)}>
        <DialogContent className="bg-zinc-950 border border-zinc-900 text-zinc-100 max-w-sm rounded-[24px]">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">Детали транзакции</DialogTitle></DialogHeader>
          {selectedTx && (
            <div className="space-y-4 pt-2 text-[11px]">
              <div className="text-center p-4 bg-zinc-900/30 border border-zinc-900/60 rounded-2xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{selectedTx.type === "incoming" ? "Сумма получения" : "Сумма отправки"}</p>
                <p className={`text-2xl font-black ${selectedTx.isPend && !selectedTx.isIncoming ? "text-zinc-400" : selectedTx.type === "incoming" ? "text-emerald-400" : "text-white"}`}>{selectedTx.type === "incoming" ? "+" : "-"}{selectedTx.amount} XCH</p>
              </div>
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-zinc-500 font-medium">Статус ноды:</span>
                {selectedTx.isPend || txStatus?.status === "IN_MEMPOOL" ? ( <span className={`${selectedTx.type === "incoming" ? "text-emerald-400" : "text-zinc-400"} font-bold flex items-center gap-1 text-[10px] uppercase animate-pulse`}><Clock size={12} /> В Мемпуле</span> ) : txStatus?.status === "CONFIRMED" ? ( <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px] uppercase"><CheckCircle2 size={12} /> Подтверждена</span> ) : ( <span className="text-emerald-500 font-bold flex items-center gap-1 text-[10px] uppercase"><CheckCircle2 size={12} /> В блоке</span> )}
              </div>
              <div className="space-y-2 bg-zinc-900/10 p-3 border border-zinc-900/40 rounded-xl">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-zinc-500 font-semibold shrink-0">Адрес:</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-right text-zinc-300 break-all select-all">{selectedTx.computedAddress}</span>
                    <button onClick={() => handleCopy(selectedTx.computedAddress)} className="text-zinc-500 hover:text-white p-1 rounded shrink-0">{copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}</button>
                  </div>
                </div>
                <div className="flex justify-between items-center h-5"><span className="text-zinc-500 font-semibold">Время события:</span><span className="text-zinc-300 font-medium">{fmtDate(selectedTx.timestamp, selectedTx.isPend)}</span></div>
              </div>
              
              <a 
                href={explorerUrl} 
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSelectedTx(null)} 
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-850 rounded-xl py-2.5 text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <ExternalLink size={13} /> <span>Открыть в Explorer</span>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
