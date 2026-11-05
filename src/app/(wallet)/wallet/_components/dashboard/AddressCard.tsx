'use client'

import React, { useState, useMemo } from "react"
import { Copy, Check, Loader2, AlertTriangle } from "lucide-react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { usePuzzleHashToAddress } from "@/hooks/usePuzzleHashToAddress"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

export function AddressCard() {
  const [copied, setCopied] = useState(false)

  const network = useUserSettingsStore((state) => state.network)
  const isMainnet = network === 'mainnet'

  const { addresses, isLoading: isDashboardLoading } = useWalletDashboard()

  const targetObj = addresses && addresses.length > 0
    ? (addresses.find((a: any) => a.index === 0) || addresses[0])
    : null

  const address0 = usePuzzleHashToAddress(targetObj?.puzzle_hash)
  const isLoaded = !isDashboardLoading && address0 !== ""

  // Разбиваем адрес на три части для визуального акцента на краях
  const formattedAddress = useMemo(() => {
    if (!address0 || address0.length < 12) return null
    return {
      start: address0.slice(0, 7), // префикс + первые символы (например, txch122)
      middle: address0.slice(7, -6), // скрытая приглушенная середина
      end: address0.slice(-6) // последние 6 символов для сверки хвоста
    }
  }, [address0])

  const copyAddress = async () => {
    if (!isLoaded) return
    try {
      await navigator.clipboard.writeText(address0)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Не удалось скопировать адрес:", err)
    }
  }

  return (
    <div className="bg-zinc-900/30 border border-zinc-900 shadow-xl backdrop-blur-xl rounded-[24px] p-4 space-y-2.5 relative w-full">
      <div className="flex items-center justify-between">
        
        <div className="flex items-center gap-1.5 px-0.5 select-none group cursor-help relative">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Ваш адрес Chia ({isMainnet ? 'mainnet' : 'testnet11'})
          </span>

          {!isMainnet && (
            <div className="flex items-center">
              <AlertTriangle 
                size={11} 
                className="text-zinc-500 group-hover:text-[#FF2E93] transition-colors duration-200" 
              />
              
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-[240px] p-2.5 bg-[#0c0c0e] border border-zinc-800 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.6)] text-[9px] font-bold text-zinc-400 uppercase tracking-wider leading-normal z-50 animate-in fade-in zoom-in-95 duration-100">
                <span className="text-[#FF2E93] font-black block mb-0.5">⚠️ ТЕСТОВАЯ СЕТЬ TESTNET11</span>
                Вы переключены на тестовую сеть. Адреса полностью отличаются от основной сети XCH.
                <div className="absolute top-full left-4 border-4 border-transparent border-t-[#0c0c0e]" />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={copyAddress}
          disabled={!isLoaded}
          className={`flex items-center gap-1 text-[10px] font-bold bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-850/60 transition-all ${
            isLoaded ? "text-zinc-400 hover:text-white cursor-pointer active:scale-95" : "text-zinc-600 border-zinc-900/40 cursor-not-allowed opacity-50"
          }`}
        >
          {copied ? (
            <Check size={11} className="text-emerald-400 animate-in fade-in zoom-in-75 duration-200" />
          ) : (
            <Copy size={11} />
          )}
          <span>{copied ? "Скопирован" : "Копировать"}</span>
        </button>
      </div>

      <div className="bg-zinc-950/50 border border-zinc-900 p-3 rounded-xl font-mono text-[11px] min-h-[42px] flex items-center justify-start overflow-hidden">
        {isLoaded && formattedAddress ? (
          <div className="w-full text-left break-all select-all leading-normal tracking-wider animate-in fade-in duration-300">
            <span className="text-zinc-100 font-bold">{formattedAddress.start}</span>
            <span className="text-zinc-500 font-medium">{formattedAddress.middle}</span>
            <span className="text-zinc-100 font-bold">{formattedAddress.end}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider animate-pulse w-full justify-center">
            <Loader2 size={12} className="animate-spin text-[#FF2E93]" />
            <span>Синхронизация адресов...</span>
          </div>
        )} 
      </div>
    </div>
  )
}
