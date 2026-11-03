'use client'

import React from "react"
import { AlertCircle } from "lucide-react"
import { renderHighlightedAddress } from "@/lib/utils/ui"
import { useSendModalContext } from "./SendModalContext"
import { formatMojoToXchString } from "@/lib/utils"

export function SendStepTwo() {
  const {
    loading,
    preparedSpendData,
    pin,
    setPin,
    targetAddress
  } = useSendModalContext()

  const audit = preparedSpendData?.audit_info

  const getNetSentToRecipientMojo = () => {
    return audit ? BigInt(audit.disposition.target.amount_mojo) : 0n
  }

  const getTotalOutflowMojo = () => {
    if (!audit) return 0n
    const target = BigInt(audit.disposition.target.amount_mojo)
    const networkFee = BigInt(audit.summary.fee_network_mojo)
    const dustFee = audit.summary.is_dust_fee_collected 
      ? BigInt(audit.disposition.dust_fee.amount_mojo) 
      : 0n
    return target + networkFee + dustFee
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-start gap-2 text-amber-400 bg-amber-500/5 p-3 rounded-xl text-xs border border-amber-500/10">
        <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
        <span className="leading-relaxed">Пожалуйста, проверьте сумму и адрес получателя перед подтверждением.</span>
      </div>
      
      <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl space-y-3 text-sm max-h-[42vh] overflow-y-auto scrollbar-thin">
        <div className="space-y-2.5 text-xs">
          
          <div className="flex justify-between items-center bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-900">
            <span className="text-zinc-400 font-bold">Будет списано с баланса:</span>
            <span className="font-black text-white text-xs font-mono">
              {audit ? formatMojoToXchString(getTotalOutflowMojo()) : "0 XCH"}
            </span>
          </div>
          
          {audit && (
            <div className="px-1.5 space-y-1.5 border-l-2 border-zinc-800 my-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-500">Получателю уйдет:</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {formatMojoToXchString(getNetSentToRecipientMojo())}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-[11px] text-zinc-500">
                <span>Сетевая комиссия ноды:</span>
                <span className="font-mono text-zinc-400">
                  {formatMojoToXchString(audit.summary.fee_network_mojo)}
                </span>
              </div>

              {audit.summary.is_dust_fee_collected && (
                <div className="flex justify-between items-center text-[11px] text-zinc-500">
                  <span>Пылевая комиссия кошелька:</span>
                  <span className="font-mono text-zinc-400">
                    {formatMojoToXchString(audit.disposition.dust_fee.amount_mojo)}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-900">
            <span className="text-zinc-400 font-medium">Адрес получателя:</span>
            <div className="relative w-full bg-zinc-900/30 p-3 rounded-xl border border-zinc-850/60 text-center select-none font-mono tracking-tight text-zinc-300">
              {renderHighlightedAddress(targetAddress)}
            </div>
          </div>
        </div>
      </div>
      
      <div className="pt-1">
        <label className="block text-xs font-medium text-zinc-400 mb-1.5 pl-0.5">Код безопасности (ПИН)</label>
        <input 
          type="password" 
          maxLength={6} 
          placeholder="••••••" 
          value={pin} 
          onChange={(e) => setPin(e.target.value)} 
          disabled={loading} 
          autoFocus 
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-center tracking-widest focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 text-white disabled:opacity-55 transition-all" 
          required 
        />
      </div>
    </div>
  )
}
