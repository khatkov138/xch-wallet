'use client'
import React, { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowUpRight, ArrowDownLeft, Layers, RefreshCw, LogOut, ChevronRight } from "lucide-react"

export default function LandingPage() {
  const [copied, setCopied] = useState(false), [age, setAge] = useState(0), [tab, setTab] = useState<'wallet' | 'exp'>('wallet')
  useEffect(() => { const i = setInterval(() => setAge(p => p >= 18 ? 0 : p + 1), 1000); return () => clearInterval(i) }, [])
  const handleCopy = () => { navigator.clipboard.writeText("txch1220nyw8zx9tf93jsj7hd2na2euz747ueuvj23h26q753w550uedqu4n9g8"); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="w-full flex flex-col justify-between flex-1 selection:bg-[#FF2E93]/30">
      <header className="w-full h-14 flex items-center justify-between border-b border-zinc-900/40 backdrop-blur-sm bg-zinc-950/10 rounded-xl px-2">
        <div className="flex items-center gap-2 select-none">
          <Link href="/" className="relative bg-zinc-900/40 border border-zinc-850 text-white font-black text-xs px-3 py-1 rounded-xl">XCH<span className="text-[#FF2E93]">IA</span><span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#FF2E93]" /></Link>
          <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded border text-zinc-500 bg-zinc-900/20 border-zinc-900">TESTNET11</span>
        </div>
        <Link href="/wallet" className="text-[11px] font-bold uppercase bg-white text-zinc-950 px-3.5 py-1.5 rounded-xl hover:bg-zinc-200 transition-all">Вход</Link>
      </header>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-10 lg:py-16 flex-1">
        <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-400"><span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" /> 100% OPEN SOURCE & БЕЗ СКАЧИВАНИЙ</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05]">Безопасный кошелек <br />для Chia (XCH) <br /><span className="bg-gradient-to-r from-[#FF2E93] to-[#8B5CF6] bg-clip-text text-transparent">в твоем браузере</span></h1>
          {/* 🎯 ДОБАВИЛИ КРУТОЙ МЕССЕДЖ ПРО ОТКРЫТЫЙ ИСХОДНЫЙ КОД И GITHUB */}
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">Ваша случайная фраза из 24 слов и ключи <strong className="text-zinc-200 font-bold">никогда не отправляются на наш сервер</strong>. Наш проект имеет <strong className="text-[#FF2E93] font-bold">полностью открытый исходный код на GitHub</strong> — всё проверяемо и прозрачно. Мы лишь выступаем в роли посыльного между вами и блокчейном Chia.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2 items-center">
            <Link href="/wallet" className="w-full sm:w-auto text-[11px] font-black uppercase bg-white text-zinc-950 px-6 py-3.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-lg shadow-white/5"><span>Открыть веб-кошелек</span> <ChevronRight size={12} /></Link>
            <Link href="/explorer" className="w-full sm:w-auto text-[11px] font-bold uppercase bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 px-5 py-3.5 rounded-xl transition-all">Открыть Explorer</Link>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col items-center justify-center w-full">
          <div className="flex items-center justify-between w-full max-w-[340px] mb-3 px-1">
            <div className="inline-flex p-0.5 bg-zinc-900/40 border border-zinc-900 rounded-lg gap-0.5 text-[9px] font-bold uppercase tracking-wider">
              <button onClick={() => setTab('wallet')} className={`px-3 py-1 rounded cursor-pointer ${tab === 'wallet' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Кошелек</button>
              <button onClick={() => setTab('exp')} className={`px-3 py-1 rounded cursor-pointer ${tab === 'exp' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Эксплорер</button>
            </div>
            <Link href="/explorer" className="text-[9px] font-bold text-zinc-500 hover:text-[#FF2E93] bg-zinc-900/20 px-2 py-1 rounded-md border border-zinc-900">Explorer →</Link>
          </div>

          <div className="w-full max-w-[340px] bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-4 shadow-2xl relative text-left">
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
                  <div className="flex justify-between items-center text-[8px] font-bold text-zinc-500 uppercase"><span>Адрес Chia</span><button onClick={handleCopy} className="text-zinc-400 flex items-center gap-0.5 bg-zinc-900 px-1.5 py-0.2 border border-zinc-800 rounded cursor-pointer">{copied ? "Да!" : "Копировать"}</button></div>
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
              <div className="space-y-3 animate-in fade-in duration-150 text-[9px]">
                <div className="flex justify-between font-black text-zinc-300"><span>EXPLORER</span><span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">WebSocket Live</span></div>
                <div className="grid grid-cols-2 gap-1.5 font-bold">
                  <div className="bg-zinc-900/20 border border-zinc-900 p-2 rounded-lg"><p className="text-zinc-500">Высота сети</p><p className="text-xs font-black text-white font-mono">#6,432,981</p></div>
                  <div className="bg-zinc-900/20 border border-zinc-900 p-2 rounded-lg"><p className="text-zinc-500">Скорость ноды</p><p className="text-xs font-black text-emerald-400 font-mono">4.2 BPM</p></div>
                </div>
                <div className="space-y-1"><p className="text-zinc-500 font-bold uppercase text-[8px]">Живой поток блоков</p><div className="p-1 bg-zinc-900/10 border border-zinc-900 rounded-lg font-mono"><div className="flex justify-between p-1.5 bg-[#FF2E93]/5 border border-[#FF2E93]/20 rounded-md font-bold text-white"><span>#6432981</span><span className="text-zinc-400">{age} сек назад</span></div></div></div>
              </div>
            )}
          </div>
        </div>

      </div>

      <footer className="w-full text-center text-[10px] text-zinc-600 font-medium py-2"><p>© 2026 xchia.io. Next.js & FastAPI. Разработано для сообщества Chia Network.</p></footer>
    </div>
  )
}
