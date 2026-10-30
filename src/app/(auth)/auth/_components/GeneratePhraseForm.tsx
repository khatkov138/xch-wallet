'use client'

import React, { useState, useEffect } from "react"
import { ShieldCheck, RefreshCw, Check, ArrowRight, Printer } from "lucide-react"
import * as bip39 from "bip39"



import { PapperWalletPrintout } from "@/app/(dashboard)/dashboard/_components/PapperWalletPrintout"
import { Button } from "@/components/ui/button"

interface GeneratePhraseFormProps {
  onSubmit: (phrase: string) => void
}

export function GeneratePhraseForm({ onSubmit }: GeneratePhraseFormProps) {
  // Локальные стейты формы генерации фразы
  const [generatedPhrase, setGeneratedPhrase] = useState("")
  const [isAgreed, setIsAgreed] = useState(false)

  // Локальная генерация слов через bip39
  const generateNewWalletWords = () => {
    try {
      const mnemonic = bip39.generateMnemonic(256)
      setGeneratedPhrase(mnemonic)
    } catch (e) {
      setGeneratedPhrase("Ошибка инициализации bip39.")
    }
  }

  // Генерируем фразу автоматически при монтировании формы
  useEffect(() => {
    generateNewWalletWords()
  }, [])

  const wordsArray = generatedPhrase ? generatedPhrase.split(" ") : []

  const handleFormSubmit = () => {
    if (!generatedPhrase || generatedPhrase.startsWith("Ошибка")) return
    
    // Сигнализируем базовые флаги инициализации в localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem("xcha_mnemonic", "true")
      localStorage.setItem("xcha_is_auth", "true")
    }
    
    // Передаем сгенерированную фразу наверх в родительский обработчик
    onSubmit(generatedPhrase)
  }

  return (
    <div className="space-y-4 flex flex-col justify-between h-full">
      {/* Компактное предупреждение */}
      <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-2.5 text-[11px] text-amber-300/90 font-medium flex gap-2 leading-tight print:hidden">
        <ShieldCheck size={16} className="shrink-0 text-amber-400 mt-0.5" />
        <span>Запиши эти слова на бумаге. Это единственный ключ к твоим средствам.</span>
      </div>

      {/* Компактная зона мнемоники в 3 колонки — БЕЗ системного скролла */}
      <div className="relative bg-zinc-950/90 border border-zinc-900 rounded-2xl p-3 transition-colors hover:border-zinc-850 print:hidden">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-900">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-0.5">
            Мнемоника (24 слова)
          </span>
          <button
            type="button"
            onClick={generateNewWalletWords}
            className="text-zinc-400 hover:text-[#FF2E93] active:scale-95 transition-all p-1 rounded-lg hover:bg-zinc-900 cursor-pointer"
            title="Сгенерировать заново"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* 3 колонки, крупные овалы */}
        <div className="grid grid-cols-3 gap-1.5 select-none">
          {wordsArray.map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 bg-zinc-900/40 border border-zinc-900/60 rounded-full pl-1.5 pr-2 py-1 transition-all hover:bg-zinc-900/80"
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
      </div>

      {/* ЗОНА ДЕЙСТВИЙ БЕЗОПАСНОСТИ */}
      <div className="space-y-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/20 border border-zinc-900 rounded-xl py-2 text-[10px] font-bold uppercase tracking-wide transition-all active:scale-[0.98] hover:bg-zinc-900/60 cursor-pointer"
        >
          <Printer size={13} className="text-[#FF2E93]" />
          <span>Быстрая печать бумажного сейфа / PDF</span>
        </button>

        <label className="flex items-center gap-3 px-1 min-h-[24px] cursor-pointer select-none group w-full">
          <div className="relative shrink-0 flex items-center justify-center">
            <input
              type="checkbox"
              checked={isAgreed}
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

      {/* Главная кнопка действия */}
      <Button
        onClick={handleFormSubmit}
        disabled={!isAgreed}
        className={`w-full font-bold text-sm h-12 rounded-xl transition-all border-none flex items-center justify-center gap-2 print:hidden ${isAgreed
          ? 'bg-white hover:bg-zinc-200 text-black active:scale-[0.98] cursor-pointer'
          : 'bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none'
          }`}
      >
        <span>Продолжить к защите</span>
        <ArrowRight size={16} className={isAgreed ? "text-[#FF2E93]" : "text-zinc-600"} />
      </Button>

      {/* Скрытый печатный бланк бумажного кошелька */}
      <PapperWalletPrintout mnemonic={generatedPhrase} walletAddress="" />
    </div>
  )
}
