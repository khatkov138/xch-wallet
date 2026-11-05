'use client';

import React from "react"
import { Loader2 } from "lucide-react"

export default function WalletGlobalLoading() {
  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center relative overflow-hidden select-none">
      
      {/* Дорогой Web3 фишка: глубокое, очень мягкое неоновое свечение за логотипом */}
      <div className="absolute w-[220px] h-[220px] bg-[#FF2E93]/8 blur-[90px] rounded-full animate-pulse pointer-events-none" />
      
      <div className="flex flex-col items-center gap-5 relative z-10">
        
        {/* Строгий бруталистичный логотип-карточка XCHA (копия оригинального бренда) */}
        <div className="bg-white text-black font-black text-xl px-5 py-2.5 rounded-2xl tracking-tight shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative border border-white">
          XCH<span className="text-[#FF2E93]">A</span>
          
          {/* Акцентная неоновая точка на углу карточки */}
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF2E93] border-2 border-zinc-950" />
        </div>
        
        {/* Минималистичный лоадер, приглушенный в zinc-палитру */}
        <div className="flex items-center gap-2 text-zinc-500 font-mono text-[10px] tracking-widest uppercase">
          <Loader2 size={12} className="animate-spin text-zinc-500" />
          <span>wallet loading.tsx</span>
        </div>
        
      </div>
    </div>
  )
}
