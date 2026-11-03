'use client'

import React from "react"
import { TrendingDown, ShieldCheck, Zap } from "lucide-react"
import { useSendModalContext } from "./SendModalContext"
import { formatMojoToXchString } from "@/lib/utils"

export function SendStepOne() {
  const {
    loading,
    targetAddress,
    setTargetAddress,
    amount,
    setAmount,
    selectedTier,
    setSelectedTier,
    customFeeMojo,
    setCustomFeeMojo,
    dynamicFees,
    getFeeInXchString,
    realXCHStr
  } = useSendModalContext()
  
  const btnConfig = [
    { t: "low", l: "Низкая", icon: TrendingDown, cl: "text-zinc-400" },
    { t: "medium", l: "Средняя", icon: ShieldCheck, cl: "text-amber-500" },
    { t: "high", l: "Высокая", icon: Zap, cl: "text-[#FF2E93]" }
  ] as const

  const fullBalance = realXCHStr || "0.0000"
  const numericBalance = parseFloat(fullBalance)

  // Конфиг долей: 10%, 50%, 100%
  const percentPresets = [
    { label: "10%", pct: 0.1 },
    { label: "50%", pct: 0.5 },
    { label: "100%", pct: 1.0 }
  ] as const

  // Синхронный хелпер округления для текста на кнопках
  const getPresetLabel = (pct: number): string => {
    if (!numericBalance || numericBalance <= 0) return "0.000 XCH"
    if (pct === 1.0) return `${numericBalance.toFixed(3)} XCH`
    return `${(numericBalance * pct).toFixed(3)} XCH`
  }

  // Обработчик клика по пресетам с округлением до 3 знаков (для 100% отдает полный strict-баланс)
  const handlePercentClick = (pct: number) => {
    if (!realXCHStr || numericBalance <= 0) return
    
    if (pct === 1.0) {
      setAmount(realXCHStr)
    } else {
      const rounded = (numericBalance * pct).toFixed(3)
      setAmount(rounded)
    }
  }

  return (
    <>
      {/* Секция заголовка */}
      <div className="mb-4">
        <h3 className="text-lg font-bold tracking-tight">Отправить XCH</h3>
      </div>

      {/* Инпут адреса получателя */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Адрес получателя</label>
        <input 
          type="text" 
          placeholder="xch1..." 
          value={targetAddress} 
          onChange={(e) => setTargetAddress(e.target.value)} 
          disabled={loading} 
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF2E93] focus-visible:ring-0 focus-visible:ring-offset-0 outline-none text-white transition-colors" 
          required 
        />
      </div>
      
      {/* Инпут суммы */}
      <div>
        <div className="flex justify-between items-center mb-1.5 select-none">
          <label className="block text-xs font-semibold text-zinc-400">Сумма (XCH)</label>
          <span className="text-[10px] text-zinc-500 font-bold">
            Доступно: <span className="font-mono text-zinc-400">{fullBalance}</span> XCH
          </span>
        </div>
        
        <div className="relative flex items-center">
          <input 
            type="text" 
            inputMode="decimal"
            placeholder="0.00" 
            value={amount} 
            onChange={(e) => {
              const val = e.target.value.replace(",", "."); 
              if (val === "" || /^\d*\.?\d{0,12}$/.test(val)) {
                setAmount(val)
              }
            }} 
            disabled={loading} 
            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl pl-4 pr-20 py-3 text-sm text-white font-mono outline-none focus:outline-none focus:border-[#FF2E93] focus-visible:ring-0 focus-visible:ring-offset-0" 
            required 
          />
          
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (realXCHStr && numericBalance > 0) {
                setAmount(realXCHStr)
              }
            }}
            className="absolute right-2 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black tracking-wider text-zinc-400 hover:text-white hover:border-zinc-700 cursor-pointer disabled:opacity-40 disabled:pointer-events-none select-none"
          >
            MAX
          </button>
        </div>

        {/* КНОПКИ ПРЕСЕТОВ: 10% | 50% | 100% */}
        <div className="flex gap-2 mt-2 select-none">
          {percentPresets.map(({ label, pct }, idx) => {
            const isAvailable = numericBalance > 0
            return (
              <button
                key={idx}
                type="button"
                disabled={loading || !isAvailable}
                onClick={() => handlePercentClick(pct)}
                className={`flex-1 py-1.5 rounded-lg border text-center font-mono text-[10px] font-black tracking-wider transition-all ${
                  isAvailable
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white cursor-pointer active:scale-95"
                    : "bg-zinc-950 border-zinc-900 text-zinc-600 opacity-40 cursor-not-allowed"
                }`}
              >
                {getPresetLabel(pct)}
              </button>
            )
          })}
        </div>
      </div>

      {/* БЛОК ВЫБОРА СЕТЕВОЙ КОМИССИИ */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-zinc-400">Размер комиссии</label>
        <div className="grid grid-cols-3 gap-2">
          {btnConfig.map(({ t, l, icon: Icon, cl }) => {
            const hasData = !!dynamicFees?.[t];
            const mojoVal = dynamicFees?.[t]?.mojo ?? 0;
            const secVal = dynamicFees?.[t]?.seconds ?? 0;
            const minsVal = Math.round(secVal / 60);

            return (
              <button 
                key={t} 
                type="button" 
                disabled={loading || !hasData} 
                onClick={() => { setSelectedTier(t); setCustomFeeMojo(String(mojoVal)) }} 
                className={`flex flex-col items-center py-2 px-1 rounded-xl border text-center text-white text-xs transition-all ${
                  !hasData 
                    ? "opacity-40 bg-zinc-950 border-zinc-900 cursor-not-allowed" 
                    : selectedTier === t 
                      ? "bg-zinc-800 border-zinc-700 shadow-md cursor-pointer active:scale-95" 
                      : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:border-zinc-800 cursor-pointer active:scale-95"
                }`}
              >
                <Icon size={13} className={selectedTier === t && hasData ? cl : "text-zinc-600"} />
                <span className="text-[11px] font-black mt-1">{l}</span>
                
                <span className="text-[9px] text-zinc-400 font-mono mt-0.5 whitespace-nowrap">
                  {hasData ? formatMojoToXchString(mojoVal) : "Загрузка..."}
                </span>
                
                <span className="text-[8px] text-zinc-500 font-medium mt-0.5">
                  {hasData ? `~${minsVal} мин` : "--"}
                </span>
              </button>
            )
          })}
        </div>
        <span className="block text-[10px] text-zinc-400 font-bold pl-0.5">
          ≈ {getFeeInXchString()} ({parseInt(customFeeMojo).toLocaleString()} Mojo)
        </span>
        <span className="block text-[9px] text-zinc-500 leading-normal pl-0.5 select-none">
          ℹ️ Скорость обработки транзакции зависит от размера комиссии.
        </span>
      </div>
    </>
  )
}
