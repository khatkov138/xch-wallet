'use client'

import React, { useState, useEffect } from "react"
import { ArrowRight, AlertCircle, Clipboard } from "lucide-react"

// @ts-ignore
import * as bip39 from "bip39"
import { Button } from "../../../components/ui/button"

interface ImportWalletFormProps {
  seedPhrase: string
  setSeedPhrase: (phrase: string) => void
  onSubmit: (phrase: string) => void
}

export function ImportWalletForm({ seedPhrase, setSeedPhrase, onSubmit }: ImportWalletFormProps) {
  // --- ВРЕМЕННО ЗАКАМЕНТИРОВАНО ДЛЯ ТЕСТИРОВАНИЯ ЧЕРЕЗ CTRL+V ---
  /*
  const FIXED_PLACEHOLDERS = [
    "apple", "banana", "cherry", "dog", "elephant", "fox", "giraffe", "house", 
    "iron", "jacket", "keyword", "lemon", "matrix", "nature", "oxygen", "pioneer", 
    "quantum", "radar", "shadow", "tunnel", "universe", "vacuum", "whale", "zebra"
  ]
  const [words, setWords] = useState<string[]>(Array(24).fill(""))
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [shakeIndex, setShakeIndex] = useState<number | null>(null)
  const [errorIndex, setErrorIndex] = useState<number | null>(null)
  */
  
  // Новый стейт для прямой вставки всей строки текста
  const [rawInput, setRawInput] = useState<string>("")
  
  // Берем официальный словарь из библиотеки bip39
  const bip39Wordlist: string[] = bip39.wordlists?.english || []

  // Синхронизируем текстовое поле с родительским стейтом seedPhrase
  useEffect(() => {
    // Очищаем лишние пробелы между словами
    const cleanPhrase = rawInput.trim().toLowerCase().replace(/\s+/g, " ")
    setSeedPhrase(cleanPhrase)
  }, [rawInput, setSeedPhrase])

  // --- ВРЕМЕННО ЗАКАМЕНТИРОВАНА СТАРАЯ ЛОГИКА ВВОДА ЯЧЕЕК ---
  /*
  useEffect(() => {
    const cleanPhrase = words.map(w => w.trim().toLowerCase()).join(" ")
    setSeedPhrase(cleanPhrase)
  }, [words, setSeedPhrase])

  const handleInputChange = (index: number, val: string) => {
    if (/[^a-zA-Z\s]/.test(val)) {
      setShakeIndex(index)
      setErrorIndex(index)
      setTimeout(() => setShakeIndex(null), 250)
      setTimeout(() => setErrorIndex(null), 1000)
      return
    }
    const cleanVal = val.replace(/[^a-zA-Z]/g, "").toLowerCase()
    const newWords = [...words]
    newWords[index] = cleanVal
    setWords(newWords)

    if (cleanVal.trim().length >= 1 && bip39Wordlist.length > 0) {
      const filtered = bip39Wordlist
        .filter(w => w.startsWith(cleanVal) && w !== cleanVal)
        .slice(0, 5)
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
  */

  // Новая строгая проверка валидности: должно быть ровно 24 слова, и каждое обязано быть в словаре BIP-39
  const currentWordsList = rawInput.trim().toLowerCase().split(/\s+/)
  const hasExact24Words = currentWordsList.length === 24
  
  const areAllWordsValid = hasExact24Words && currentWordsList.every(word => {
    return bip39Wordlist.includes(word)
  })

  // Кнопка станет активной только если сид-фраза полностью корректна
  const isWalletReady = areAllWordsValid

  return (
    <div className="space-y-4 flex flex-col justify-between h-full min-h-[360px]">
      
      {/* Информационный блок */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-2.5 text-[11px] text-zinc-400 font-medium flex gap-2 leading-tight">
        <AlertCircle size={15} className="shrink-0 text-[#FF2E93] mt-0.5" />
        <span>
          {hasExact24Words 
            ? (areAllWordsValid ? "Фраза валидна. Можно импортировать!" : "Ошибка: некоторые слова не входят в словарь BIP-39.") 
            : `Вставьте сид-фразу целиком (Ctrl + V). Сейчас слов: ${rawInput.trim() === "" ? 0 : currentWordsList.length} из 24.`}
        </span>
      </div>

      {/* Новый временный инпут для мгновенной вставки фразы через Ctrl+V */}
      <div className="relative flex flex-col bg-zinc-950 border border-zinc-900 focus-within:border-[#FF2E93] rounded-xl p-3 transition-all duration-200 h-[180px]">
        <div className="absolute top-2 right-2 text-zinc-600">
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

      {/* --- ЗАКАМЕНТИРОВАННАЯ ОРИГИНАЛЬНАЯ СЕТКА ЯЧЕЕК --- */}
      {/*
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
              } ...`}
            >
              ...
            </div>
          )
        })}
      </div>
      */}

      {/* Временный отступ вместо подсказок автодополнения */}
      <div className="min-h-[16px]" />

      {/* Кнопка отправки формы */}
      <Button 
        onClick={() => onSubmit(seedPhrase)}
        disabled={!isWalletReady}
        className={`w-full font-bold text-sm h-12 rounded-xl transition-all border-none flex items-center justify-center gap-2 ${
          isWalletReady 
            ? 'bg-white hover:bg-zinc-200 text-black active:scale-[0.98] cursor-pointer' 
            : 'bg-zinc-900 text-zinc-600 cursor-not-allowed opacity-50'
        }`}
      >
        <span>Импортировать кошелек</span>
        <ArrowRight size={14} />
      </Button>
    </div>
  )
}
