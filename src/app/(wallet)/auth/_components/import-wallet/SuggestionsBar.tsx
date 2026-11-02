'use client'

import React from "react"
import { Sparkles } from "lucide-react"

interface SuggestionsBarProps {
  suggestions: string[]
  activeIndex: number | null
  onApply: (index: number, word: string) => void
}

export const SuggestionsBar = React.memo(function SuggestionsBar({
  suggestions,
  activeIndex,
  onApply
}: SuggestionsBarProps) {
  const hasSuggestions = suggestions.length > 0 && activeIndex !== null

  return (
    <div className="h-[34px] flex items-center gap-2 px-2.5 border border-zinc-850 bg-zinc-900/10 rounded-xl overflow-hidden shrink-0">
      {hasSuggestions ? (
        <div className="flex items-center gap-2 animate-fade-in w-full">
          <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 select-none">
            <Sparkles size={10} className="text-[#FF2E93]" />
            <span>Варианты:</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {suggestions.map((word, idx) => (
              <button
                key={word}
                type="button"
                onClick={() => onApply(activeIndex, word)}
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-[#FF2E93] hover:text-white transition-colors cursor-pointer shrink-0 ${
                  idx === 0 ? "border-zinc-700 text-zinc-100" : ""
                }`}
              >
                {word} {idx === 0 && <span className="text-[9px] text-zinc-500 font-sans ml-0.5">(Tab)</span>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full h-full" />
      )}
    </div>
  )
})
