'use client'

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { LogOut, ChevronDown, Check } from "lucide-react"
import { useWalletStatus } from "@/hooks/useWalletStatus"
import { useWalletSession } from "@/store/useWalletStore"

interface WalletHeaderProps {
  showLogout: boolean;
  onLogout: () => void;
}

export const WalletHeader = React.memo(function WalletHeader({
  showLogout,
  onLogout
}: WalletHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const network = useWalletSession((state) => state.network)
  const isMainnet = network === 'mainnet'

  const { isLoading, hasError, isConnecting, nodeData } = useWalletStatus()

  const currentNetworkName = nodeData?.network?.toLowerCase() ?? ''
  const isCurrentStateForSelectedNetwork = 
    (isMainnet && currentNetworkName.includes('mainnet')) || 
    (!isMainnet && currentNetworkName.includes('testnet'))

  const isOnline = !isLoading && !hasError && !isConnecting && !!nodeData && isCurrentStateForSelectedNetwork

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const setNet = (nextNetwork: 'mainnet' | 'testnet11') => {
    if (network !== nextNetwork) {
      useWalletSession.getState().setNetwork(nextNetwork)
    }
    setIsOpen(false)
  }

  return (
    <header className="flex items-center justify-between w-full h-14 border-b border-zinc-900/40 backdrop-blur-sm bg-zinc-950/10 rounded-xl px-2 relative z-50 select-none">
      
      {/* ЛЕВАЯ СТОРОНА: Чистый логотип */}
      <div className="flex items-center select-none">
        <Link 
          href="/" 
          className="relative bg-zinc-900/40 border border-zinc-850 text-white font-black text-xs px-3 py-1 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
        >
          XCH<span className="text-[#FF2E93]">IA</span>
        </Link>
      </div>

      <div className="flex-1" />

      {/* ПРАВАЯ СТОРОНА: Меню выбора сети с увеличенными тач-зонами */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/80 text-zinc-300 font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all hover:border-zinc-700 hover:text-white active:scale-[0.97] cursor-pointer"
        >
          <span>{isMainnet ? 'Mainnet' : 'Testnet11'}</span>
          
          <span className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
            isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-[#FF2E93] shadow-[0_0_6px_#FF2E93] animate-pulse'
          }`} />
          
          <ChevronDown size={11} className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Дропдаун с крупными кнопками */}
        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-[160px] bg-[#0c0c0e] border border-zinc-800 rounded-xl p-1 shadow-[0_12px_30px_rgba(0,0,0,0.6)] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
            
            {/* Кнопка Mainnet */}
            <button
              type="button"
              onClick={() => setNet('mainnet')}
              className={`flex items-center justify-between w-full px-3.5 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isMainnet ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900/40'
              }`}
            >
              <span>Mainnet</span>
              {isMainnet && <Check size={12} className="text-emerald-400" />}
            </button>

            {/* Кнопка Testnet11 */}
            <button
              type="button"
              onClick={() => setNet('testnet11')}
              className={`flex items-center justify-between w-full px-3.5 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                !isMainnet ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900/40'
              }`}
            >
              <span>Testnet11</span>
              {!isMainnet && <Check size={12} className="text-[#FF2E93]" />}
            </button>

            {showLogout && (
              <>
                <div className="border-t border-zinc-900/60 my-0.5" />
                {/* Кнопка Выйти */}
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); onLogout(); }}
                  className="flex items-center justify-between w-full px-3.5 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-[#FF2E93] hover:bg-[#FF2E93]/5 transition-all cursor-pointer"
                >
                  <span>Выйти</span>
                  <LogOut size={12} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

    </header>
  )
})
