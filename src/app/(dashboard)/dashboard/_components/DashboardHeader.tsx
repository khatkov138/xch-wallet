'use client'

import React from "react"
import { LogOut } from "lucide-react"

export function DashboardHeader() {
  const handleLogOut = () => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = "/"
  }

  return (
    <header className="flex items-center justify-between w-full pt-2">
      <div className="flex items-center gap-2">
        <div className="bg-white text-black font-black text-sm px-3 py-1.5 rounded-xl tracking-tight shadow-md select-none">
          XCH<span className="text-[#FF2E93]">A</span>
        </div>
        <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900/60 px-2.5 py-0.5 rounded-md border border-zinc-800 tracking-wider">
          MAINNET
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Онлайн
        </div>
        <button 
          onClick={handleLogOut}
          className="p-1.5 rounded-lg bg-zinc-900/40 border border-zinc-850 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer active:scale-95"
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  )
}
