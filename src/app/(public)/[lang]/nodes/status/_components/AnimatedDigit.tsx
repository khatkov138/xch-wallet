'use client'

import React from "react"

export function AnimatedDigit({ digit }: { digit: string }) {
  const num = parseInt(digit, 10)
  
  if (isNaN(num)) {
    return <span className="px-0.5 text-zinc-700 selection:bg-[#FF2E93]/30">{digit}</span>
  }

  return (
    // 🚀 ИЗМЕНЕНО: Добавлен вертикальный оффсет высоты для предотвращения срезов краев
    <span className="inline-block h-[34px] sm:h-[42px] overflow-hidden relative w-[0.62em] text-center select-none font-mono selection:bg-[#FF2E93]/30">
      <span 
        className="flex flex-col absolute left-0 w-full transition-transform duration-600 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `translateY(-${num * 10}%)` }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="h-[34px] sm:h-[42px] flex items-center justify-center text-white font-black">
            {i}
          </span>
        ))}
      </span>
    </span>
  )
}
