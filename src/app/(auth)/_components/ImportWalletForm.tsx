'use client'

import React, { useState, useEffect } from "react"
import { ArrowRight, AlertCircle } from "lucide-react"

// @ts-ignore
import * as bip39 from "bip39"
import { Button } from "../../../components/ui/button"

// Фиксированный эталонный список слов для плейсхолдеров (полностью убирает рассинхрон SSR/клиент)
const FIXED_PLACEHOLDERS = [
  "apple", "banana", "cherry", "dog", "elephant", "fox", "giraffe", "house", 
  "iron", "jacket", "keyword", "lemon", "matrix", "nature", "oxygen", "pioneer", 
  "quantum", "radar", "shadow", "tunnel", "universe", "vacuum", "whale", "zebra"
]

interface ImportWalletFormProps {
  seedPhrase: string
  setSeedPhrase: (phrase: string) => void
  onSubmit: (phrase: string) => void
}

export function ImportWalletForm({ seedPhrase, setSeedPhrase, onSubmit }: ImportWalletFormProps) {
  const [words, setWords] = useState<string[]>(Array(24).fill(""))
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  
  // Состояния для анимации ошибки конкретной ячейки
  const [shakeIndex, setShakeIndex] = useState<number | null>(null)
  const [errorIndex, setErrorIndex] = useState<number | null>(null)
  
  // Берем официальный словарь из библиотеки bip39
  const bip39Wordlist: string[] = bip39.wordlists?.english || []

  // Собираем фразу для передачи в родительский компонент при изменении ячеек
  useEffect(() => {
    const cleanPhrase = words.map(w => w.trim().toLowerCase()).join(" ")
    setSeedPhrase(cleanPhrase)
  }, [words, setSeedPhrase])

  const handleInputChange = (index: number, val: string) => {
    // Если вводится не-английский символ (кириллица, спецсимволы, цифры)
    if (/[^a-zA-Z\s]/.test(val)) {
      setShakeIndex(index)
      setErrorIndex(index)
      
      // Сбрасываем триггеры анимации тряски и ошибки
      setTimeout(() => setShakeIndex(null), 250)
      setTimeout(() => setErrorIndex(null), 1000)
      return // Полностью блокируем ввод некорректного символа
    }

    const cleanVal = val.replace(/[^a-zA-Z]/g, "").toLowerCase()
    const newWords = [...words]
    newWords[index] = cleanVal
    setWords(newWords)

    // Поиск подсказок по официальному словарю BIP-39
    if (cleanVal.trim().length >= 1 && bip39Wordlist.length > 0) {
      const filtered = bip39Wordlist
        .filter(w => w.startsWith(cleanVal) && w !== cleanVal)
        .slice(0, 5) // Показываем топ-5 совпадений
      setSuggestions(filtered)
    } else {
      setSuggestions([])
    }
  }

  const selectSuggestion = (index: number, word: string) => {
    const newWords = [...words]
    newWords[index] = word
    setWords(newWords)
    setSuggestions([])
    
    // Автоматически переносим фокус на следующую ячейку
    if (index < 23) {
      const nextInput = document.getElementById(`word-${index + 1}`)
      nextInput?.focus()
    } else {
      setActiveIndex(null)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    
    // Блокируем вставку, если в буфере есть не-EN символы
    if (/[^a-zA-Z\s]/.test(pastedText)) {
      setShakeIndex(0)
      setTimeout(() => setShakeIndex(null), 250)
      return
    }

    const splitWords = pastedText.trim().split(/\s+/).slice(0, 24)
    if (splitWords.length > 0) {
      const newWords = [...words]
      splitWords.forEach((word, idx) => {
        if (idx < 24) newWords[idx] = word.toLowerCase()
      })
      setWords(newWords)
    }
  }

  // Проверяем, что все 24 ячейки заполнены и введенные слова существуют в словаре BIP-39
  const isWalletReady = words.every(w => {
    const clean = w.trim().toLowerCase()
    return clean.length > 0 && bip39Wordlist.includes(clean)
  })

  return (
    <div className="space-y-4 flex flex-col justify-between h-full">
      {/* Компактное информационное сообщение */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-2.5 text-[11px] text-zinc-400 font-medium flex gap-2 leading-tight">
        <AlertCircle size={15} className="shrink-0 text-[#FF2E93] mt-0.5" />
        <span>Введите слова. Приложение подсветит кнопку только если все 24 слова введены без ошибок.</span>
      </div>

      {/* Премиальная сетка 8x3 ячеек */}
      <div className="grid grid-cols-3 gap-2 max-h-[290px] overflow-y-auto pr-1 no-scrollbar">
        {words.map((word, index) => {
          const isWordValid = word.trim() === "" || bip39Wordlist.includes(word.trim().toLowerCase())
          const isShaking = shakeIndex === index
          const hasError = errorIndex === index

          return (
            <div 
              key={index} 
              className={`relative flex items-center bg-zinc-950 border rounded-xl pl-2.5 pr-1.5 py-1 transition-all duration-200 ${
                isShaking ? 'animate-shake' : ''
              } ${
                hasError
                  ? 'border-red-500 bg-red-950/20 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                  : activeIndex === index 
                    ? 'border-[#FF2E93]' 
                    : !isWordValid 
                      ? 'border-red-500/50 bg-red-950/10' 
                      : 'border-zinc-900 hover:border-zinc-850'
              }`}
            >
              {/* Индекс ячейки */}
              <span className={`text-[9px] font-mono font-bold shrink-0 w-4 transition-colors ${hasError ? 'text-red-400' : 'text-zinc-600'}`}>
                {index + 1}
              </span>
              
              {/* Поле ввода */}
              <input
                id={`word-${index}`}
                type="text"
                value={hasError ? "" : word}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onFocus={() => {
                  setActiveIndex(index)
                  handleInputChange(index, word)
                }}
                onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                onPaste={index === 0 ? handlePaste : undefined}
                placeholder={hasError ? "ONLY EN" : FIXED_PLACEHOLDERS[index]}
                className={`w-full bg-transparent text-[12px] font-sans font-bold outline-none border-none p-0 focus:ring-0 truncate transition-colors ${
                  hasError ? 'placeholder-red-500 font-black text-center' : 'text-zinc-200 placeholder-zinc-800'
                }`}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
          )
        })}
      </div>

      {/* Горизонтальный скролл подсказок автодополнения */}
      <div className="min-h-[32px] relative z-20">
        {activeIndex !== null && suggestions.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 bg-zinc-900/90 border border-zinc-800 rounded-xl px-2 backdrop-blur-md no-scrollbar">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tight shrink-0 mr-1">Выбрать:</span>
            {suggestions.map((word) => (
              <button
                key={word}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // Исключает случайное скрытие клавиатуры при тапе
                onClick={() => selectSuggestion(activeIndex, word)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-mono font-bold text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition-colors active:scale-95 shrink-0"
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Контрастная кнопка отправки формы */}
      <Button 
        onClick={() => onSubmit(seedPhrase)}
        disabled={!isWalletReady}
        className={`w-full font-bold text-sm h-12 rounded-xl transition-all border-none flex items-center justify-center gap-2 ${
          isWalletReady 
            ? 'bg-white hover:bg-zinc-200 text-black active:scale-[0.98] cursor-pointer' 
            : 'bg-zinc-900 text-zinc-600 cursor-not-allowed shadow-none'
        }`}
      >
        <span>Войти в кошелек</span>
        <ArrowRight size={16} className={isWalletReady ? "text-[#FF2E93]" : "text-zinc-600"} />
      </Button>
    </div>
  )
}
