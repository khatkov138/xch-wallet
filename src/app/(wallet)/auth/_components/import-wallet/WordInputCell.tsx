'use client'

import React from "react"

interface WordInputCellProps {
  index: number
  word: string
  placeholder: string
  hasError: boolean
  isFocused: boolean
  showLangWarning: boolean
  inputRef: (el: HTMLInputElement | null) => void
  onChange: (index: number, value: string) => void
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void
  onPaste: (index: number, e: React.ClipboardEvent<HTMLInputElement>) => void
  onFocus: (index: number) => void
  onBlur: (index: number) => void
}

export const WordInputCell = React.memo(function WordInputCell({
  index,
  word,
  placeholder,
  hasError,
  isFocused,
  showLangWarning,
  inputRef,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur
}: WordInputCellProps) {
  return (
    <div 
      className={`relative flex items-center gap-1.5 bg-zinc-900/40 border rounded-full pl-1.5 pr-2 py-0.5 h-[30px] transition-colors duration-150 ${
        showLangWarning || hasError
          ? "border-[#FF2E93] bg-[#FF2E93]/5" 
          : isFocused 
            ? "border-[#FF2E93]" 
            : "border-zinc-850"
      }`}
    >
      {/* Микро-тултип предупреждения "ТОЛЬКО АНГЛ. ЯЗЫК" */}
      {showLangWarning && (
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-20 bg-zinc-950 border border-[#FF2E93] px-2 py-0.5 rounded text-[8px] font-bold text-[#FF2E93] whitespace-nowrap tracking-wide uppercase shadow-lg shadow-black/80 animate-fade-in">
          Only ENG
        </div>
      )}

      <span className={`text-[9px] font-mono font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors select-none ${
        showLangWarning || hasError ? "bg-[#FF2E93] text-black" : "bg-zinc-950/60 text-zinc-500"
      }`}>
        {index + 1}
      </span>
      
      <input
        ref={inputRef}
        type="text"
        value={word}
        onChange={(e) => onChange(index, e.target.value)}
        onKeyDown={(e) => onKeyDown(index, e)}
        onPaste={(e) => onPaste(index, e)}
        onFocus={() => onFocus(index)}
        onBlur={() => onBlur(index)}
        placeholder={placeholder}
        title="Разрешены только английские буквы"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full bg-transparent text-[12px] font-sans font-bold text-zinc-200 placeholder-zinc-800 outline-none border-none p-0 focus:ring-0 truncate tracking-tight"
      />
    </div>
  )
})
