'use client'

import React, { useState, useEffect } from "react"
import { Copy, Check, Loader2 } from "lucide-react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard" // 🎯 Переключились на главный хук дашборда
import { useWalletStatus } from "@/hooks/useWalletStatus"

import { puzzleHashToAddress } from "@/lib/utils/crypto"

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16)
  }
  return bytes
}



export function AddressCard() {
  const [copied, setCopied] = useState(false)

  // 🎯 ТЕПЕРЬ КАК НАДО: Забираем адреса и статус загрузки напрямую из корневого хука дашборда
  const { addresses, isLoading: isDashboardLoading } = useWalletDashboard()

  // Достаем имя сети для префикса
  const { nodeData } = useWalletStatus()

  const networkName = nodeData?.network || "mainnet"
  const currentPrefix = networkName.toLowerCase().includes("testnet") ? "txch" : "xch"

  // Безопасный поиск индекса 0
  const targetObj = addresses && addresses.length > 0
    ? (addresses.find((a: any) => a.index === 0) || addresses[0])
    : null

  const puzzleHash = targetObj?.puzzle_hash || ""
  const address0 = puzzleHashToAddress(puzzleHash, currentPrefix)

  // Карточка готова, когда строка адреса успешно собрана в bech32m
  const isLoaded = !isDashboardLoading && address0 !== ""

 
  const copyAddress = async () => {
    if (!isLoaded) return
    try {
      await navigator.clipboard.writeText(address0)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Не удалось скопировать адрес в буфер:", err)
    }
  }

  return (
    <div className="bg-zinc-900/30 border border-zinc-900 shadow-xl backdrop-blur-xl rounded-[24px] p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-0.5">
          Ваш адрес Chia ({!isLoaded ? "..." : currentPrefix === "xch" ? "Mainnet" : "Testnet"})
        </span>
        <button
          onClick={copyAddress}
          disabled={!isLoaded}
          className={`flex items-center gap-1 text-[10px] font-bold bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-850/60 transition-all ${isLoaded
              ? "text-zinc-400 hover:text-white cursor-pointer active:scale-95"
              : "text-zinc-600 border-zinc-900/40 cursor-not-allowed opacity-50"
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

      <div className="bg-zinc-950/50 border border-zinc-900 p-3 rounded-xl font-mono text-[11px] text-zinc-300 break-all select-all leading-normal tracking-tight min-h-[42px] flex items-center justify-center">
        {isLoaded ? (
          <span className="w-full text-left font-semibold tracking-wider text-zinc-200 animate-in fade-in duration-300">
            {address0}
          </span>
        ) : (
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider animate-pulse">
            <Loader2 size={12} className="animate-spin text-[#FF2E93]" />
            <span>Синхронизация адресов...</span>
          </div>
        )}
      </div>
    </div>
  )
}
