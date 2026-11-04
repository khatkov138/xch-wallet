'use client'

import React, { useState, useMemo, memo } from "react"
import { ShieldCheck, RefreshCw, Check, ArrowRight, Printer, KeyRound } from "lucide-react"
import * as bip39 from "bip39"

import { Button } from "@/components/ui/button"
import { PapperWalletPrintout } from "@/components/PapperWalletPrintout"

interface GeneratePhraseFormProps {
  onSubmit: (phrase: string) => void
}
export function GeneratePhraseForm({ onSubmit }: GeneratePhraseFormProps) {
  const [phrase, setPhrase] = useState<string>("")

  console.log("⚡ [RENDER] GeneratePhraseForm. Есть фраза:", phrase !== "")

  const generateNewWalletWords = React.useCallback(() => {
    try {
      setPhrase(bip39.generateMnemonic(256))
    } catch (e) {
      setPhrase("Ошибка bip39.")
    }
  }, [])

  const wordsArray = useMemo(() => {
    return phrase ? phrase.split(" ") : []
  }, [phrase])

  const handleFormSubmit = React.useCallback(() => {
    if (!phrase || phrase.startsWith("Ошибка")) return
    onSubmit(phrase)
  }, [phrase, onSubmit])

  const handlePrint = React.useCallback(() => {
    window.print()
  }, [])

  const hasPhrase = phrase !== "" && !phrase.startsWith("Ошибка")

  return (
    <div className="space-y-4 flex flex-col justify-between h-full min-h-[520px]">
      
      {/* Предупреждение безопасности (Варнинг строго в янтарной палитре) */}
      <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-2.5 text-[11px] text-amber-400 font-medium flex gap-2 leading-tight print:hidden">
        <ShieldCheck size={16} className="shrink-0 text-amber-500 mt-0.5" />
        <span>Запиши эти слова на бумаге. Это единственный ключ к твоим средствам.</span>
      </div>

      {/* Зона мнемоники / Заглушки (Брутальный минимализм, border-zinc-850) */}
      <div className="relative bg-zinc-950/40 border border-zinc-850 rounded-xl p-3 min-h-[220px] flex flex-col justify-between print:hidden">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-850 w-full shrink-0">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-0.5">
            Мнемоника (24 слова)
          </span>
          {hasPhrase && (
            <button
              type="button"
              onClick={generateNewWalletWords}
              className="text-zinc-400 hover:text-[#FF2E93] active:scale-95 transition-all p-1 rounded-lg hover:bg-zinc-900 cursor-pointer"
              title="Сгенерировать заново"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        {!hasPhrase ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <button
              type="button"
              onClick={generateNewWalletWords}
              className="group flex flex-col items-center justify-center gap-2 border border-dashed border-zinc-800 hover:border-[#FF2E93]/40 bg-zinc-900/20 hover:bg-[#FF2E93]/5 rounded-xl w-full py-8 transition-all duration-200 cursor-pointer"
            >
              <div className="p-2.5 bg-zinc-900 border border-zinc-850 rounded-lg text-zinc-400 group-hover:text-[#FF2E93] group-hover:border-[#FF2E93]/20 transition-colors">
                <KeyRound size={20} />
              </div>
              <span className="text-[12px] font-bold text-zinc-300 group-hover:text-white transition-colors uppercase tracking-wide">
                Сгенерировать ключ-слова
              </span>
              <span className="text-[10px] text-zinc-500 max-w-[200px] leading-tight">
                Будет создана новая безопасная 24-словная мнемоника
              </span>
            </button>
          </div>
        ) : (
          /* 🛡️ ФИКС АНИМАЦИИ: Заменили 'animate-in fade-in' на чистый 'motion-safe:animate-fade-in' БЕЗ скейла и зума */
          <div className="grid grid-cols-3 gap-1.5 select-none animate-fade-in flex-1">
            {wordsArray.map((word, index) => (
              <div 
                key={index} 
                className="flex items-center gap-1.5 bg-zinc-900/40 border border-zinc-850 rounded-full pl-1.5 pr-2 py-1 h-[27px] transition-colors duration-150 hover:bg-zinc-900/80"
              >
                <span className="text-[9px] font-mono font-bold text-zinc-500 bg-zinc-950/60 h-4.5 w-4.5 rounded-full flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <span className="text-[13px] font-sans font-bold text-zinc-200 truncate tracking-tight select-all">
                  {word}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Оставляем вызов ActionBlock как у тебя, прокидывая оригинальные обработчики */}
      <ActionBlock 
        onPrint={handlePrint}
        onSubmit={handleFormSubmit}
        disabled={!hasPhrase}
      />

      {phrase && <PapperWalletPrintout mnemonic={phrase} />}
    </div>
  )
}

const ActionBlock = memo(({ 
  onPrint, 
  onSubmit, 
  disabled 
}: { 
  onPrint: () => void; 
  onSubmit: () => void; 
  disabled: boolean 
}) => {
  const [isAgreed, setIsAgreed] = useState(false)
  
  console.log("🔍 [TICK] ActionBlock")

  return (
    <div className="space-y-4">
      <div className="space-y-3 print:hidden">
        <button
          type="button"
          onClick={onPrint}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/20 border border-zinc-900 rounded-xl py-2 text-[10px] font-bold uppercase tracking-wide transition-all active:scale-[0.98] hover:bg-zinc-900/60 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <Printer size={13} className="text-[#FF2E93]" />
          <span>Быстрая печать бумажного сейфа / PDF</span>
        </button>

        <label className={`flex items-center gap-3 px-1 min-h-[24px] select-none group w-full ${disabled ? 'cursor-not-allowed opacity-25' : 'cursor-pointer'}`}>
          <div className="relative shrink-0 flex items-center justify-center">
            <input
              type="checkbox"
              checked={isAgreed}
              disabled={disabled}
              onChange={(e) => setIsAgreed(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-4.5 h-4.5 border-2 border-zinc-700 peer-checked:border-[#FF2E93] peer-checked:bg-[#FF2E93] rounded-full transition-all flex items-center justify-center shadow-sm" />
            <Check size={9} className="absolute inset-0 m-auto text-black font-black scale-0 peer-checked:scale-100 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-300 transition-colors uppercase tracking-wide pt-0.5">
            Я надежно сохранил фразу и принимаю риски
          </span>
        </label>
      </div>

      <Button
        onClick={onSubmit}
        disabled={!isAgreed || disabled}
        className={`w-full font-bold text-sm h-12 rounded-xl transition-all border-none flex items-center justify-center gap-2 print:hidden ${
          isAgreed && !disabled
            ? 'bg-white hover:bg-zinc-200 text-black active:scale-[0.98] cursor-pointer'
            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none'
        }`}
      >
        <span>Создать кошелек</span>
        <ArrowRight size={16} className={isAgreed && !disabled ? "text-[#FF2E93]" : "text-zinc-600"} />
      </Button>
    </div>
  )
})
ActionBlock.displayName = "ActionBlock"
