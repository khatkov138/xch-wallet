'use client'
import React, { useState } from "react"
import { usePuzzleHashToAddress } from "@/hooks/usePuzzleHashToAddress"

export function UtxoCard({ addr, unspentCoins }: { addr: any; unspentCoins: any[] }) {
  const realAddr = usePuzzleHashToAddress(addr.puzzle_hash)
  const [copied, setCopied] = useState(false)
  const coins = unspentCoins.filter((c: any) => c.wallet_index === addr.index)
  const shortAddr = realAddr ? `${realAddr.substring(0, 7)}...${realAddr.substring(realAddr.length - 6)}` : "..."

  const handleCopy = async () => {
    if (!realAddr) return
    try {
      await navigator.clipboard.writeText(realAddr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Не удалось скопировать адрес:", err)
    }
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900/30 p-2.5 rounded-xl space-y-1.5">
      <div className="flex justify-between items-start text-xs border-b border-zinc-800 pb-1.5">
        <div>
          <div className="text-xs font-bold text-white">{addr.index === 0 ? "Индекс 0 ⭐" : `Индекс ${addr.index}`}</div>
          <div className="flex items-center gap-1 mt-0.5 h-4">
            <span className="text-[10px] font-medium text-zinc-500 font-mono" title={realAddr}>📍 {shortAddr}</span>
            {realAddr && (
              <button 
                type="button" 
                onClick={handleCopy} 
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-0.5 rounded hover:bg-zinc-800 flex items-center justify-center w-5 h-5 shrink-0"
                title="Скопировать полный адрес"
              >
                {copied ? (
                  <svg xmlns="http://w3.org" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-in fade-in zoom-in-75 duration-150">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://w3.org" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-emerald-400 block">{addr.xch} XCH</span>
          <span className="text-[9px] font-bold text-zinc-500 block">Монет: {coins.length} шт.</span>
        </div>
      </div>
      <div className="space-y-1 pt-0.5 max-h-20 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800/60 scrollbar-track-transparent">
        {coins.length === 0 ? <span className="text-[10px] font-medium text-zinc-600 italic block pl-1">Нет доступных UTXO</span> :
          coins.map((item: any, i: number) => (
            <div key={i} className="flex justify-between bg-zinc-950/70 border border-zinc-850 px-2 py-1 rounded text-[10px] font-mono hover:border-zinc-800 transition-colors">
              <span className="text-zinc-500">P: {item.coin.parent_coin_info.substring(0, 8)}...</span>
              <span className="text-zinc-400 font-bold">{(Number(item.coin.amount) / 1e12).toFixed(4)} XCH</span>
            </div>
          ))}
      </div>
    </div>
  )
}
