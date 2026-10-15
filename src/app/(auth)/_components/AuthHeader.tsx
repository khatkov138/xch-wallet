'use client'

import React from "react"

interface AuthHeaderProps {
  version?: string
}

export function AuthHeader({ version = "v0.2.0" }: AuthHeaderProps) {
  return (
    <header className="flex items-center justify-between w-full pt-2 select-none">
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center bg-white text-black font-black text-xl px-4 py-1.5 rounded-2xl tracking-tight shadow-md">
          XCH<span className="text-[#FF2E93]">A</span>
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#FF2E93] border-2 border-zinc-950" />
        </div>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{version}</span>
      </div>
      <div className="bg-zinc-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
        Non-Custodial
      </div>
    </header>
  )
}
