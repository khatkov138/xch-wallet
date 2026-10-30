'use client'

import React, { useState } from "react"
import { Copy, Check, Eye, EyeOff, ShieldAlert, Printer } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"


import { PapperWalletPrintout } from "./PapperWalletPrintout"


export function BackupCard() {
  // Забираем сид-фразу напрямую из хука без повторных крипто-вычислений на фронте
  const mnemonic = ''

  const [showSeed, setShowSeed] = useState(false)
  const [copiedSeed, setCopiedSeed] = useState(false)

  const copySeedPhrase = () => {
    if (!mnemonic) return
    navigator.clipboard.writeText(mnemonic)
    setCopiedSeed(true)
    setTimeout(() => setCopiedSeed(false), 2000)
  }

  return (
    <>
      <Card className="bg-zinc-900/30 border border-zinc-900 rounded-[24px] shadow-xl overflow-hidden print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400/90">
              <ShieldAlert size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Резервная копия</span>
            </div>

            <div className="flex items-center gap-2">
              {showSeed && mnemonic && (
                <button
                  onClick={() => window.print()}
                  className="text-zinc-400 hover:text-white px-2 py-1 rounded-md bg-zinc-950 text-[10px] font-bold border border-zinc-850 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  <Printer size={12} className="text-[#FF2E93]" />
                  <span>Печать / PDF</span>
                </button>
              )}

              <button
                onClick={() => setShowSeed(!showSeed)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                {showSeed ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showSeed ? "Скрыть" : "Показать фразу"}</span>
              </button>

              {showSeed && mnemonic && (
                <button
                  onClick={copySeedPhrase}
                  className="text-zinc-400 hover:text-white px-2 py-0.5 rounded-md bg-zinc-950 text-[10px] font-mono border border-zinc-850 flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedSeed ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  <span>{copiedSeed ? "ОК" : "Copy Seed"}</span>
                </button>
              )}
            </div>
          </div>

          {showSeed ? (
            <div className="p-3 bg-zinc-950/80 border border-zinc-900 rounded-xl font-mono text-[11px] text-zinc-400 leading-relaxed tracking-tight select-all">
              {mnemonic || "Мнемоника не найдена в безопасной памяти сессии"}
            </div>
          ) : (
            <div className="p-3 bg-zinc-950/30 border border-zinc-900/60 rounded-xl flex items-center justify-center text-[10px] text-zinc-600 font-bold uppercase tracking-wider select-none py-4">
              •••• •••• •••• •••• •••• ••••
            </div>
          )}
        </CardContent>
      </Card>

      <PapperWalletPrintout mnemonic={mnemonic}  />
    </>
  )
}
