'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import * as bip39 from "bip39"

interface UseImportPhraseProps {
  onSubmit: (phrase: string) => void
}

export function useImportPhrase({ onSubmit }: UseImportPhraseProps) {
  const [words, setWords] = useState<string[]>(() => Array(24).fill(""))
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [placeholders, setPlaceholders] = useState<string[]>(() => Array(24).fill(""))
  const [invalidInputIndex, setInvalidInputIndex] = useState<number | null>(null)
  const inputRefs = useRef<HTMLInputElement[]>([])

  const bip39Wordlist = useMemo(() => {
    return (bip39.wordlists as Record<string, string[]> | undefined)?.english || []
  }, [])

  useEffect(() => {
    if (bip39Wordlist.length > 0) {
      const shuffled = [...bip39Wordlist].sort(() => 0.5 - Math.random())
      setPlaceholders(shuffled.slice(0, 24))
    }
  }, [bip39Wordlist])

  const clearAllWords = useCallback(() => {
    setWords(Array(24).fill(""))
    setActiveIndex(null)
    setInvalidInputIndex(null)
    if (inputRefs.current && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const setAllWordsFromString = useCallback((phraseString: string) => {
    const parsedWords = phraseString.trim().split(/\s+/).filter(Boolean)
    if (parsedWords.length !== 24) return false
    setWords(parsedWords)
    setActiveIndex(null)
    return true
  }, [])

  const currentWord = useMemo(() => {
    if (activeIndex === null) return ""
    return words[activeIndex].trim().toLowerCase()
  }, [words, activeIndex])

  const suggestions = useMemo(() => {
    if (!currentWord) return []
    return bip39Wordlist.filter(word => word.startsWith(currentWord)).slice(0, 3)
  }, [currentWord, bip39Wordlist])

  const applySuggestion = useCallback((index: number, word: string) => {
    setWords(prev => {
      const next = [...prev]
      next[index] = word
      return next
    })
    if (index < 23) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleWordChange = useCallback((index: number, value: string) => {
    if (/[^a-zA-Z]/.test(value)) {
      setInvalidInputIndex(index)
      setTimeout(() => setInvalidInputIndex(prev => prev === index ? null : prev), 1500)
    }

    const cleanValue = value.replace(/[^a-zA-Z]/g, "").toLowerCase()
    setWords(prev => {
      const next = [...prev]
      next[index] = cleanValue
      return next
    })
  }, [])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !words[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    if (e.key === "Tab" || e.key === "Enter") {
      if (currentWord.length > 0) {
        if (suggestions.length > 0) {
          e.preventDefault()
          applySuggestion(index, suggestions[0])
        } else {
          e.preventDefault()
        }
      }
    }
  }, [words, currentWord, suggestions, applySuggestion])

  const handlePaste = useCallback((index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
  }, [])

  const handleCellBlur = useCallback((index: number) => {
    setTimeout(() => setActiveIndex(prev => prev === index ? null : prev), 150)
  }, [])

  const validatedWords = useMemo(() => {
    return words.map(word => {
      const trimmed = word.trim()
      if (!trimmed) return { word: "", isEmpty: true, isValid: false }
      return { word: trimmed, isEmpty: false, isValid: bip39Wordlist.includes(trimmed) }
    })
  }, [words, bip39Wordlist])

  const isWalletReady = useMemo(() => validatedWords.every(w => w.isValid), [validatedWords])

  const handleFormSubmit = useCallback(() => {
    if (!isWalletReady) return
    onSubmit(words.map(w => w.trim().toLowerCase()).join(" "))
  }, [isWalletReady, words, onSubmit])

  const statusStyles = useMemo(() => {
    const totalFilled = validatedWords.filter(w => !w.isEmpty).length

    if (totalFilled === 0) {
      return { 
        box: "border-zinc-850 bg-zinc-900/20 text-zinc-400", 
        text: "Вводите слова по порядку. Используйте [Tab] или [Enter] для быстрого автодополнения слова из подсказок." 
      }
    }
    if (isWalletReady) {
      return { 
        box: "border-zinc-700 bg-zinc-900/40 text-zinc-200", 
        text: "Все 24 слова успешно сверены со словарем BIP-39. Проверьте окружение перед импортом." 
      }
    }
    return { 
      box: "border-zinc-850 bg-zinc-900/20 text-zinc-400", 
      text: `Контроль ввода: заполнено ячеек ${totalFilled} из 24.` 
    }
  }, [validatedWords, isWalletReady])

  return {
    words,
    activeIndex,
    inputRefs,
    suggestions,
    placeholders,
    invalidInputIndex,
    validatedWords,
    isWalletReady,
    statusStyles,
    clearAllWords,
    setAllWordsFromString,
    applySuggestion,
    handleWordChange,
    handleKeyDown,
    handlePaste,
    handleCellBlur,
    setActiveIndex,
    handleFormSubmit
  }
}
