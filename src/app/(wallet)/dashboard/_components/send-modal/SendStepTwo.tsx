'use client'

import React from "react"
import { AlertCircle } from "lucide-react"
import { renderHighlightedAddress } from "@/lib/utils/ui"
import { useSendModalContext } from "./SendModalContext"

export function SendStepTwo() {
  const {
    loading,
    preparedSpendData,
    pin,
    setPin,
    targetAddress,
    getTotalOutflowString,
    getFeeInXchString
  } = useSendModalContext()

  const audit = preparedSpendData?.audit_info

  return (
    <>
      <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl space-y-3 text-sm max-h-[42vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-start gap-2 text-amber-400 bg-amber-500/10 p-2.5 rounded-lg text-xs border border-amber-500/20"><AlertCircle size={14} className="shrink-0 mt-0.5" /><span>Пожалуйста, внимательно проверьте данные транзакции перед вводом ПИН-кода.</span></div>
        <div className="border-t border-zinc-900 pt-2 space-y-2 text-xs">
          <div className="flex justify-between items-center"><span className="text-zinc-400 font-bold">Всего к списанию:</span><span className="font-black text-white text-sm bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{getTotalOutflowString()}</span></div>
          {audit && (
            <>
              <div className="flex justify-between items-center border-t border-zinc-900 pt-2"><span>Будет отправлено получателю:</span><span className="font-bold text-emerald-400 font-mono">{`${(Number(audit.disposition.target.amount_mojo) / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`}</span></div>
              <div className="flex justify-between items-center text-zinc-500"><span>Сетевая комиссия (майнерам):</span><span className="font-mono text-zinc-400">{`- ${getFeeInXchString()}`}</span></div>
              {audit.summary.is_dust_fee_collected && (
                <div className="flex justify-between items-center text-zinc-500"><span>Пылевая комиссия кошелька:</span><span className="font-mono text-zinc-400">{`- ${(Number(audit.disposition.dust_fee.amount_mojo) / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`}</span></div>
              )}
            </>
          )}
          <div className="flex flex-col gap-1 pt-2 border-t border-zinc-900 text-xs"><span>Адрес получателя:</span><div className="relative w-full bg-zinc-900/50 p-4 pt-6 rounded-xl border border-zinc-850 flex items-center justify-center text-center select-none min-h-[72px]">{renderHighlightedAddress(targetAddress)}</div></div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Введите ПИН-код кошелька</label>
        <input type="password" maxLength={6} placeholder="••••••" value={pin} onChange={(e) => setPin(e.target.value)} disabled={loading} autoFocus className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-center tracking-widest focus:outline-none focus:border-[#FF2E93] text-white" required />
      </div>
    </>
  )
}
