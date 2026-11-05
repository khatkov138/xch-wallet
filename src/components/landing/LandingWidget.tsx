'use client'
import React, { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, ArrowDownLeft, Layers, RefreshCw, LogOut } from "lucide-react"
import { CopyAddressButton } from "./CopyAddressButton"
import { WalletLanguage } from "@/config/i18n"

interface LandingWidgetProps {
  currentLang: WalletLanguage
}

export function LandingWidget({ currentLang }: LandingWidgetProps) {
  const [tab, setTab] = useState<'wallet' | 'exp'>('wallet')

  return (
    <div className="lg:col-span-5 flex flex-col items-center justify-center w-full">
      <div className="flex items-center justify-between w-full max-w-[340px] mb-3 px-1">
        <div className="inline-flex p-0.5 bg-zinc-900/40 border border-zinc-900 rounded-lg gap-0.5 text-[9px] font-bold uppercase tracking-wider">
          <button onClick={() => setTab('wallet')} className={`px-3 py-1 rounded cursor-pointer ${tab === 'wallet' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Кошелек</button>
          <button onClick={() => setTab('exp')} className={`px-3 py-1 rounded cursor-pointer ${tab === 'exp' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Эксплорер</button>
        </div>
        <Link href={`/${currentLang}/explorer`} className="text-[9px] font-bold text-zinc-500 hover:text-[#FF2E93] bg-zinc-900/20 px-2 py-1 rounded-md border border-zinc-900">Explorer →</Link>
      </div>

      <div className="w-full max-w-[340px] bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-4 shadow-2xl relative text-left min-h-[360px]">
        {tab === 'wallet' ? (
          <div className="space-y-4 animate-in fade-in duration-150">
            <header className="flex items-center justify-between h-6 text-[9px] font-black">
              <div className="flex items-center gap-1.5"><span className="text-white">XCH<span className="text-[#FF2E93]">IA</span></span><span className="text-zinc-500 bg-zinc-900/20 px-1 py-0.2 rounded border border-zinc-900">TESTNET11</span></div>
              <div className="flex items-center gap-1"><span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1 border border-emerald-500/20"><span className="h-1 w-1 rounded-full bg-emerald-400" />Online</span><button className="p-1 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-md"><LogOut size={10} /></button></div>
            </header>
            <section className="text-center py-1 space-y-0.5 relative">
              <div className="absolute inset-0 m-auto w-24 h-12 bg-[#FF2E93]/10 blur-2xl pointer-events-none" />
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1">Доступный баланс <RefreshCw size={8} /></p>
              <h2 className="text-2xl font-black text-white">1.5547 <span className="text-zinc-500 font-medium text-lg">XCH</span></h2>
              <p className="text-[10px] font-bold text-zinc-400">≈ 165,73 ₽</p>
            </section>
            <div className="p-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-1">
              <div className="flex justify-between items-center text-[8px] font-bold text-zinc-500 uppercase"><span>Адрес Chia</span><CopyAddressButton /></div>
              <p className="font-mono text-[9px] text-zinc-400 break-all leading-tight bg-zinc-950/40 p-1.5 rounded">txch1220nyw8zr9tf93jsj7hd2na2euz747ueuvj23h26q753w550uedqu4n9g8</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-center">
              <div className="p-2 border border-zinc-900 bg-zinc-900/20 rounded-xl text-zinc-300 flex items-center justify-center gap-1"><ArrowDownLeft size={12} className="text-emerald-400" /> Получить</div>
              <div className="p-2 bg-white text-zinc-950 rounded-xl flex items-center justify-center gap-1 shadow-sm font-black"><ArrowUpRight size={12} /> Отправить</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[8px] font-bold text-zinc-500 uppercase flex items-center gap-1"><Layers size={9} /> Последняя активность</div>
              <div className="bg-zinc-900/10 border border-zinc-900/50 rounded-xl p-1"><div className="flex justify-between items-center p-1.5 bg-zinc-900/20 rounded-lg text-[10px]"><div><p className="font-bold text-white">Получено XCH</p><p className="text-[8px] text-zinc-500">txch12...u4n9g8</p></div><div className="text-right"><p className="font-black text-emerald-400">+0.7769</p><p className="text-[8px] text-zinc-500">13:53</p></div></div></div>
            </div>
          </div>
        ) : (
          /* Восстановленный и закрытый блок Эксплорера */
          <div className="space-y-3 animate-in fade-in duration-150 text-[9px]">
            <div className="flex justify-between font-black text-zinc-300"><span>EXPLORER</span><span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">WebSocket Live</span></div>
            <div className="grid grid-cols-2 gap-1.5 font-bold">
              <div className="bg-zinc-900/20 border border-zinc-900 p-2 rounded-lg"><p className="text-zinc-500">Высота сети</p><p className="text-xs font-black text-white font-mono">#6,432,981</p></div>
              <div className="bg-zinc-900/20 border border-zinc-900 p-2 rounded-lg"><p className="text-zinc-500">Скорость ноды</p><p className="text-xs font-black text-emerald-400 font-mono">4.2 BPM</p></div>
            </div>
            <div className="p-2 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-1">
              <p className="text-zinc-500 font-bold uppercase text-[7px]">Последний блок Chia</p>
              <div className="font-mono text-zinc-400 space-y-0.5">
                <p className="truncate">Hash: 0x4f1a...b2c3</p>
                <p>Time: Just now</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
