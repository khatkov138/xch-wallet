'use client'

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { LogOut, ChevronDown, Check } from "lucide-react"
import { useNodesStatus } from "@/hooks/useNodesStatus"
import { useQuery } from "@tanstack/react-query"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

const INTERNAL_NEXT_PRICES_API = "/api/nextjs/prices"

interface PricesResponse {
  success: boolean;
  source: string;
  usd: number;
  rub: number;
}

interface WalletHeaderProps {
  showLogout: boolean;
  onLogout: () => void;
}

export const WalletHeader = React.memo(function WalletHeader({ showLogout, onLogout }: WalletHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ⚡ АТОМАРНЫЕ ПРИМИТИВЫ ДЛЯ ZUSTAND
  const network = useUserSettingsStore((state) => state.network)
  const currency = useUserSettingsStore((state) => state.currency)
  const language = useUserSettingsStore((state) => state.language)
  const isAuth = useUserSettingsStore((state) => state.isAuth)
  
  const setNetwork = useUserSettingsStore((state) => state.setNetwork)
  const setCurrency = useUserSettingsStore((state) => state.setCurrency)
  const setLanguage = useUserSettingsStore((state) => state.setLanguage)

  const isMainnet = network === 'mainnet'

  // 🚀 ПОДКЛЮЧАЕМ НАШ ОБНОВЛЕННЫЙ ХУК
  const { isPythonDown, networks } = useNodesStatus()

  // Достаем стейт именно той ноды, которая сейчас активна на фронте
  const activeNodeStatus = networks[network] || { isLoading: true, isRpcDown: false, isConnecting: false, nodeData: null }
  const { nodeData, isRpcDown, isConnecting, isLoading } = activeNodeStatus

  // 🚀 ЖЁСТКИЙ И ТОЧНЫЙ РАСЧЁТ СВЕТОДИОДА ДЛЯ ШАПКИ
  let ledClass = "bg-zinc-500 shadow-[0_0_5px_#71717a] animate-pulse" // Дефолт при загрузке (Серый пульс)

  if (mounted) {
    if (isPythonDown || isRpcDown) {
      // Оффлайн состояние ноды -> Фирменный красный/розовый
      ledClass = "bg-[#FF2E93] shadow-[0_0_6px_#FF2E93]"
    } else if (isConnecting) {
      // Поиск пиров -> Янтарный пульс
      ledClass = "bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse"
    } else if (nodeData) {
      if (nodeData.isSynced) {
        // Полный синк и нормальная работа -> Изумрудный неон
        ledClass = "bg-emerald-400 shadow-[0_0_6px_#34d399]"
      } else {
        // Идет синхронизация (Syncing) -> Спокойный строгий серый пульс
        ledClass = "bg-zinc-500 shadow-[0_0_5px_#71717a] animate-pulse"
      }
    }
  }

  const { data: marketData } = useQuery<PricesResponse>({
    queryKey: ["xchMarketPriceNextRouter"],
    queryFn: async () => (await fetch(INTERNAL_NEXT_PRICES_API)).json(),
    staleTime: 15000
  })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const setNet = (nextNetwork: 'mainnet' | 'testnet11') => {
    if (network !== nextNetwork) setNetwork(nextNetwork)
    setIsOpen(false)
  }

  const toggleLanguage = () => {
    setLanguage(language === 'ru' ? 'en' : 'ru')
  }

  return (
    <header className="flex items-center justify-between w-full h-14 border-b border-zinc-900/40 backdrop-blur-sm bg-zinc-950/10 rounded-xl px-2 relative z-50 select-none">
      <div className="flex items-center gap-3">
        <Link href="/" className="relative bg-zinc-900/40 border border-zinc-850 text-white font-black text-xs px-3 py-1 rounded-xl active:scale-[0.98]">
          XCH<span className="text-[#FF2E93]">IA</span>
        </Link>

        {mounted && marketData && (
          <div className="text-[10px] font-bold text-zinc-400 border border-zinc-900 bg-zinc-900/10 px-2.5 py-1 rounded-xl animate-in fade-in duration-300">
            XCH: ${marketData.usd?.toFixed(2)}
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLanguage}
          title={language === 'ru' ? "Switch to English" : "Переключить на Русский"}
          className="flex items-center justify-center w-9 h-8 bg-zinc-900/50 border border-zinc-800/80 rounded-xl hover:border-zinc-700 active:scale-[0.95] transition-all text-[10px] font-black tracking-wider text-zinc-400 hover:text-white"
        >
          {language.toUpperCase()}
        </button>

        {isAuth && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/80 text-zinc-300 font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl hover:border-zinc-700 hover:text-white active:scale-[0.97]"
            >
              <span>{isMainnet ? 'Mainnet' : 'Testnet11'}</span>
              <span className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${ledClass}`} />
              <ChevronDown size={11} className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full right-0 mt-2 w-[170px] bg-[#0c0c0e] border border-zinc-800 rounded-xl p-1 shadow-[0_12px_30px_rgba(0,0,0,0.6)] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 pt-1 pb-0.5 text-[8px] font-black text-zinc-600 tracking-wider uppercase">Сеть</div>

                <button
                  type="button"
                  onClick={() => setNet('mainnet')}
                  className={`flex items-center justify-between w-full px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${isMainnet ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900/40'}`}
                >
                  <span>Mainnet</span>
                  {/* 🚀 ИЗМЕНЕНО: Строгая серая галочка вместо зелёной */}
                  {isMainnet && <Check size={12} className="text-zinc-500" />}
                </button>

                <button
                  type="button"
                  onClick={() => setNet('testnet11')}
                  className={`flex items-center justify-between w-full px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${!isMainnet ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900/40'}`}
                >
                  <span>Testnet11</span>
                  {/* 🚀 ИЗМЕНЕНО: Строгая серая галочка вместо розовой */}
                  {!isMainnet && <Check size={12} className="text-zinc-500" />}
                </button>

                <div className="border-t border-zinc-900/60 my-0.5" />
                <div className="px-2 pt-1 pb-0.5 text-[8px] font-black text-zinc-600 tracking-wider uppercase">Валюта баланса</div>

                <button
                  type="button"
                  onClick={() => { setCurrency('USD'); setIsOpen(false); }}
                  className={`flex items-center justify-between w-full px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${currency === 'USD' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900/40'}`}
                >
                  <span>USD ($)</span>
                  {/* 🚀 Строгая серая галочка */}
                  {currency === 'USD' && <Check size={12} className="text-zinc-500" />}
                </button>

                <button
                  type="button"
                  onClick={() => { setCurrency('RUB'); setIsOpen(false); }}
                  className={`flex items-center justify-between w-full px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${currency === 'RUB' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900/40'}`}
                >
                  <span>RUB (₽)</span>
                  {/* 🚀 Строгая серая галочка */}
                  {currency === 'RUB' && <Check size={12} className="text-zinc-500" />}
                </button>

                {showLogout && (
                  <>
                    <div className="border-t border-zinc-900/60 my-0.5" />
                    <button
                      type="button"
                      onClick={() => { onLogout(); setIsOpen(false); }}
                      className="flex items-center justify-between w-full px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-white hover:bg-zinc-900/40"
                    >
                      <span>Выйти</span>
                      <LogOut size={11} className="text-zinc-500" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
})
