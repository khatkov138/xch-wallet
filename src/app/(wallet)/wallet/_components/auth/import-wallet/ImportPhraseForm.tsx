'use client'

import React, { useMemo, useState, useCallback } from "react"
import { ArrowRight, AlertCircle, Trash2, QrCode } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SuggestionsBar } from "./SuggestionsBar"
import { WordInputCell } from "./WordInputCell"
import { QrScannerModule } from "./QrScannerModule"
import { useImportPhrase } from "./useImportPhrase"

interface ImportPhraseFormProps {
  onSubmit: (phrase: string) => void
}

export function ImportPhraseForm({ onSubmit }: ImportPhraseFormProps) {
  const {
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
  } = useImportPhrase({ onSubmit })

  // Управляем видимостью камеры
  const [isScanning, setIsScanning] = useState(false)

  const correctWordsCount = useMemo(() => {
    return validatedWords.filter(w => w.isValid).length
  }, [validatedWords])

  const hasAnyContent = useMemo(() => words.some(w => w !== ""), [words])

  const handleScanSuccess = useCallback((phrase: string) => {
    const success = setAllWordsFromString(phrase)
    if (success) {
      setIsScanning(false)
    }
  }, [setAllWordsFromString])

  return (
    <div className="relative space-y-4 flex flex-col justify-between h-full min-h-[540px] animate-fade-in">
      
      {/* 🛡️ КРИТИЧЕСКИЙ ФИКС ДЛЯ ANDROID CHROME:
          Рендерим камеру на верхнем уровне всей формы, изолируя абсолютную высоту от схлопывания */}
      {isScanning ? (
        <QrScannerModule 
          onScanSuccess={handleScanSuccess} 
          onClose={() => setIsScanning(false)} 
        />
      ) : (
        <>
          <div className={`rounded-xl border p-2.5 text-[11px] font-medium flex gap-2 leading-tight transition-colors duration-150 ${statusStyles.box}`}>
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-current" />
            <span>{statusStyles.text}</span>
          </div>

          <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-3 flex flex-col gap-3 grow">
            
            {/* Шапка зоны мнемоники */}
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-850 w-full shrink-0 h-[24px] select-none">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-0.5">
                Мнемоника (24 слова)
              </span>
              
              <div className="flex items-center gap-3">
                <span className={`text-[9px] font-mono font-bold tracking-wide transition-colors ${
                  correctWordsCount === 24 ? "text-emerald-400" : "text-zinc-500"
                }`}>
                  {correctWordsCount}/24 СЛОВ ВЕРНО
                </span>

                {/* ИНТЕРАКТИВНАЯ КНОПКА С ТУЛТИПОМ ДЛЯ ЗАПУСКА СКАНИРОВАНИЯ */}
                {correctWordsCount === 0 && (
                  <div className="relative group flex items-center">
                    <button
                      type="button"
                      onClick={() => setIsScanning(true)}
                      className="text-zinc-500 hover:text-[#FF2E93] transition-colors p-1 rounded-lg hover:bg-zinc-900 cursor-pointer flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide"
                      title="Сканировать бумажный бэкап"
                    >
                      <QrCode size={11} className="text-[#FF2E93]" />
                      <span>Сканировать</span>
                    </button>
                    
                    {/* Информационный тултип безопасности */}
                    <div className="absolute bottom-6 right-0 z-30 hidden group-hover:block bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl w-[220px] shadow-2xl shadow-black animate-fade-in pointer-events-none">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide leading-tight normal-case">
                        Быстрый импорт по QR, если у вас есть физический печатный сейф с сайта <span className="text-[#FF2E93] font-mono select-all">xcha.io</span>
                      </p>
                    </div>
                  </div>
                )}

                {hasAnyContent && (
                  <button
                    type="button"
                    onClick={clearAllWords}
                    className="text-zinc-500 hover:text-[#FF2E93] transition-colors p-1 rounded-lg hover:bg-zinc-900 cursor-pointer flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide animate-fade-in"
                    title="Очистить всю форму"
                  >
                    <Trash2 size={11} />
                    <span>Очистить</span>
                  </button>
                )}
              </div>
            </div>

            <SuggestionsBar 
              suggestions={suggestions} 
              activeIndex={activeIndex} 
              onApply={applySuggestion} 
            />

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 select-none">
              {validatedWords.map((item, index) => (
                <WordInputCell
                  key={index}
                  index={index}
                  word={words[index]}
                  placeholder={placeholders[index]}
                  hasError={!item.isEmpty && !item.isValid}
                  isFocused={activeIndex === index}
                  showLangWarning={invalidInputIndex === index}
                  inputRef={(el) => { if (el) inputRefs.current[index] = el }}
                  onChange={handleWordChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onFocus={setActiveIndex}
                  onBlur={handleCellBlur}
                />
              ))}
            </div>
          </div>

          <div className="min-h-[8px]" />

          <Button 
            onClick={handleFormSubmit}
            disabled={!isWalletReady}
            className={`w-full font-bold text-sm h-12 rounded-xl transition-colors border-none flex items-center justify-center gap-2 ${
              isWalletReady 
                ? 'bg-white hover:bg-zinc-200 text-black cursor-pointer' 
                : 'bg-zinc-900 text-zinc-600 cursor-not-allowed shadow-none'
            }`}
          >
            <span>Импортировать кошелек</span>
            <ArrowRight size={14} className={isWalletReady ? "text-[#FF2E93]" : "text-zinc-600"} />
          </Button>
        </>
      )}
    </div>
  )
}
