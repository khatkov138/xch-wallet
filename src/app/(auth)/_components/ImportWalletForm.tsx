'use client'

import React, { useState, useEffect } from "react"
import { ArrowRight, AlertCircle, Clipboard } from "lucide-react"
import * as bip39 from "bip39"
import { Button } from "../../../components/ui/button"

interface ImportWalletFormProps {
  seedPhrase: string
  setSeedPhrase: (phrase: string) => void
  onSubmit: (phrase: string) => void
}

export function ImportWalletForm({ seedPhrase, setSeedPhrase, onSubmit }: ImportWalletFormProps) {
  // Инициализируем локальный ввод из входящего пропса для сохранения состояния
  const [rawInput, setRawInput] = useState<string>(seedPhrase)
  
  // Безопасно вытягиваем английский словарь BIP-39 без @ts-ignore
  const bip39Wordlist = (bip39.wordlists as Record<string, string[]> | undefined)?.english || []

  // Синхронизируем текстовое поле с родительским стейтом с очисткой дублирующихся пробелов
  useEffect(() => {
    const cleanPhrase = rawInput.trim().toLowerCase().replace(/\s+/g, " ")
    setSeedPhrase(cleanPhrase)
  }, [rawInput, setSeedPhrase])

  // Безопасно формируем список слов, исключая пустые пробельные элементы
  const currentWordsList = rawInput.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const wordsCount = currentWordsList.length
  const hasExact24Words = wordsCount === 24
  
  // Проверяем, что каждое слово входит в официальный стандарт BIP-39
  const areAllWordsValid = hasExact24Words && currentWordsList.every(word => bip39Wordlist.includes(word))
  const isWalletReady = areAllWordsValid

  return (
    <div className="space-y-4 flex flex-col justify-between h-full min-h-[360px]">
      
      {/* Динамический блок уведомлений об ошибках / валидации */}
      <div className={`rounded-xl border p-2.5 text-[11px] font-medium flex gap-2 leading-tight transition-colors duration-200 ${
        rawInput.trim() === "" 
          ? "border-zinc-800 bg-zinc-900/30 text-zinc-400"
          : isWalletReady
            ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
            : "border-red-500/20 bg-red-500/5 text-red-400"
      }`}>
        <AlertCircle size={15} className={`shrink-0 mt-0.5 ${
          rawInput.trim() === "" ? "text-zinc-500" : isWalletReady ? "text-emerald-400" : "text-red-400"
        }`} />
        <span>
          {rawInput.trim() === "" 
            ? "Вставьте сид-фразу целиком (Ctrl + V). Требуется ровно 24 слова."
            : hasExact24Words 
              ? (areAllWordsValid ? "Фраза полностью валидна. Можно импортировать сейф!" : "Ошибка: некоторые слова не входят в словарь BIP-39.") 
              : `Неверное количество слов. Сейчас введено: ${wordsCount} из 24.`}
        </span>
      </div>

      {/* Поле быстрого импорта сид-фразы */}
      <div className="relative flex flex-col bg-zinc-950 border border-zinc-900 focus-within:border-[#FF2E93] rounded-xl p-3 transition-all duration-200 h-[180px]">
        <div className="absolute top-2.5 right-2.5 text-zinc-600">
          <Clipboard size={12} />
        </div>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Вставьте сюда ваши 24 слова через пробел..."
          className="w-full h-full bg-transparent text-[12px] font-mono font-bold text-zinc-200 placeholder-zinc-800 outline-none border-none resize-none p-0 focus:ring-0 leading-relaxed"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
        />
      </div>

      <div className="min-h-[16px]" />

      {/* Главная кнопка действия */}
      <Button 
        onClick={() => onSubmit(seedPhrase)}
        disabled={!isWalletReady}
        className={`w-full font-bold text-sm h-12 rounded-xl transition-all border-none flex items-center justify-center gap-2 ${
          isWalletReady 
            ? 'bg-white hover:bg-zinc-200 text-black active:scale-[0.98] cursor-pointer' 
            : 'bg-zinc-900 text-zinc-600 cursor-not-allowed shadow-none'
        }`}
      >
        <span>Импортировать кошелек</span>
        <ArrowRight size={14} className={isWalletReady ? "text-[#FF2E93]" : "text-zinc-600"} />
      </Button>
    </div>
  )
}
