'use client'

import React from "react"
import { useSendModalContext } from "./SendModalContext"
import { formatMojoToXchString } from "@/lib/utils"
import { renderHighlightedAddress } from "@/lib/utils/ui"

export function TransactionReviewCard() {
  const { 
    step,
    targetAddress, 
    amount, 
    preparedSpendData, 
    customFeeMojo 
  } = useSendModalContext()

  const audit = preparedSpendData?.audit_info

  // Фиксированная комиссия XChia Wallet из конфига
  const builderFeeMojo = BigInt(process.env.NEXT_PUBLIC_BUILDER_FEE_MOJOS || "10000000000")

  // Канонический расчет списания от бэка (Шаг 2 и 3)
  const getTotalOutflowMojoFromBackend = () => {
    if (!audit) return 0n
    const target = BigInt(audit.disposition.target.amount_mojo)
    const networkFee = BigInt(audit.summary.fee_network_mojo)
    const dustFee = audit.summary.is_dust_fee_collected 
      ? BigInt(audit.disposition.dust_fee.amount_mojo) 
      : 0n
    return target + networkFee + dustFee
  }

  // Расчет чистой суммы получателя на Шаге 1 (Инпут минус все комиссии)
  const getClientEstimatedRecipientXch = () => {
    try {
      const trimmedAmount = amount.trim().replace(",", ".")
      if (!trimmedAmount || parseFloat(trimmedAmount) <= 0) return "0 XCH"
      
      const totalOutflowMojo = BigInt(Math.round(parseFloat(trimmedAmount) * 1e12))
      const networkFeeMojo = BigInt(String(customFeeMojo || "0").trim())
      
      // Чистая отправка получателю = Грязный инпут - Сеть - Кошелек
      const recipientMojo = totalOutflowMojo - networkFeeMojo - builderFeeMojo
      
      if (recipientMojo <= 0n) return "0 XCH"
      return formatMojoToXchString(recipientMojo)
    } catch {
      return "0 XCH"
    }
  }

  return (
    <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl space-y-3 text-sm max-h-[46vh] overflow-y-auto scrollbar-thin relative z-10 transition-all duration-200">
      <div className="space-y-2.5 text-xs">
        
        {/* ВЕРХНЯЯ СТРОКА: ИТОГОВОЕ СПИСАНИЕ (Никаких бэджей статуса, чистая строка) */}
        <div className="flex justify-between items-center bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-900">
          <span className="text-zinc-400 font-bold">Будет списано с баланса:</span>
          <span className="font-black text-white text-xs font-mono">
            {step === 1 
              ? (amount ? `${amount.trim().replace(",", ".")} XCH` : "0 XCH")
              : audit ? formatMojoToXchString(getTotalOutflowMojoFromBackend()) : "0 XCH"
            }
          </span>
        </div>
        
        {/* ДЕТАЛИЗАЦИЯ */}
        <div className="px-1.5 space-y-1.5 border-l-2 border-zinc-800 my-2">
          
          {/* 1. Сколько уйдет получателю */}
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-zinc-500">Получателю уйдет:</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {step === 1 
                ? getClientEstimatedRecipientXch()
                : formatMojoToXchString(audit ? BigInt(audit.disposition.target.amount_mojo) : 0n)
              }
            </span>
          </div>
          
          {/* 2. ⛏️ Комиссия блокчейна */}
          <div className="flex justify-between items-center text-[11px] text-zinc-500">
            <span>Комиссия блокчейна:</span>
            <span className="font-mono text-zinc-400">
              {step === 1 ? (
                (() => {
                  try {
                    const mojoBI = BigInt(String(customFeeMojo || "0").trim())
                    return mojoBI === 0n ? "0 XCH" : formatMojoToXchString(mojoBI)
                  } catch { return "0 XCH" }
                })()
              ) : (
                audit ? formatMojoToXchString(audit.summary.fee_network_mojo) : "0 XCH"
              )}
            </span>
          </div>

          {/* 3. 🔌 Комиссия XChia Wallet */}
          <div className="flex justify-between items-center text-[11px] text-zinc-500">
            <span>Комиссия XChia Wallet:</span>
            <span className="font-mono text-zinc-400">
              {step === 1 
                ? formatMojoToXchString(builderFeeMojo)
                : formatMojoToXchString(audit ? BigInt(audit?.disposition?.dust_fee?.amount_mojo || builderFeeMojo) : builderFeeMojo)
              }
            </span>
          </div>
        </div>
        
        {/* АДРЕС ПОЛУЧАТЕЛЯ */}
        {step !== 1 && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-900 animate-in fade-in duration-150">
            <span className="text-zinc-400 font-medium">Адрес получателя:</span>
            <div className="relative w-full bg-zinc-900/30 p-3 rounded-xl border border-zinc-850/60 text-center select-none font-mono tracking-tight text-zinc-300 break-all">
              {renderHighlightedAddress(targetAddress)}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
