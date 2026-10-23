'use client'

import React, { useState, useEffect, useCallback } from "react"
import { Delete, ShieldLock } from "lucide-react"

interface PinCodeFormProps {
  onSuccess: (finalPin: string) => void
}

export function PinCodeForm({ onSuccess }: PinCodeFormProps) {
  const [step, setStep] = useState<"create" | "confirm">("create")
  const [pin, setPin] = useState("")
  const [tempPin, setTempPin] = useState("")
  
  // Внутренние стейты визуала и ошибок
  const [shake, setShake] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [subtitle, setSubtitle] = useState("Для защиты ключей и подтверждения операций")

  // Оборачиваем методы в useCallback для безопасного использования внутри слушателя событий клавиатуры
  const handleNumberInput = useCallback((num: string) => {
    if (pin.length < 4 && !isLocked && !isError) {
      setPin(prev => prev + num)
    }
  }, [pin.length, isLocked, isError])

  const handleDeleteInput = useCallback(() => {
    if (!isLocked && !isError) {
      setPin(prev => prev.slice(0, -1))
    }
  }, [isLocked, isError])

  // Нативный перехват физической клавиатуры (Numpad и верхние цифры)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем нажатия с модификаторами (Ctrl, Alt, Cmd), чтобы не ломать системные хоткеи (Ctrl+R, F5)
      if (e.ctrlKey || e.altKey || e.metaKey) return

      // Проверяем, что нажата именно одиночная цифра от 0 до 9
      if (e.key >= "0" && e.key <= "9" && e.key.length === 1) {
        e.preventDefault()
        handleNumberInput(e.key)
      } 
      // Проверяем клавиши удаления
      else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault()
        handleDeleteInput()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleNumberInput, handleDeleteInput])

  useEffect(() => {
    if (pin.length === 4) {
      setIsLocked(true)

      const t = setTimeout(() => {
        if (step === "create") {
          // Шаг 1: Запоминаем первый пин, снимаем блок и переходим к подтверждению
          setTempPin(pin)
          setPin("")
          setStep("confirm")
          setSubtitle("Коды должны полностью совпадать")
          setIsLocked(false)
        } else {
          // Шаг 2: Проверяем совпадение
          if (pin === tempPin) {
            
            // ИСПРАВЛЕНИЕ ПО НОВОМУ СТАНДАРТУ БЕЗОПАСНОСТИ:
            // Жестко фиксируем созданный ПИН в сессии вкладки перед переходом на Дашборд,
            // чтобы Zustand-стор сразу мог зашифровать им генерируемую мнемонику.
            if (typeof window !== 'undefined') {
              sessionStorage.setItem("xcha_session_pin", pin)
            }

            onSuccess(pin) // Успех! Отдаем наверх готовый пин
          } else {
            // Ошибка: пины не совпали
            setIsError(true)
            setShake(true)
            setSubtitle("ПИН-коды не совпадают! Попробуй еще раз")
            
            // Трясем точки 300мс
            setTimeout(() => setShake(false), 300)
            
            // Держим блок клавиатуры и ошибку 1.2 секунды, затем возвращаем на старт
            setTimeout(() => {
              setIsError(false)
              setIsLocked(false) // Разблокируем клавиатуру только здесь
              setStep("create")
              setPin("")
              setTempPin("")
              setSubtitle("Для защиты ключей и подтверждения операций")
            }, 1200)
          }
        }
      }, 300) // 300мс задержка сверки для ощущения "вычислений"
      return () => clearTimeout(t)
    }
  }, [pin, step, tempPin, onSuccess])

  return (
    <div className="flex flex-col items-center justify-between h-[450px] w-full max-w-xs mx-auto select-none">
      
      {/* Текстовый блок */}
      <div className="text-center space-y-2 mt-2">
        <div className={`mx-auto h-10 w-10 border rounded-full flex items-center justify-center transition-colors duration-300 ${
          isError 
            ? "bg-red-500/10 border-red-500/30 text-red-500" 
            : "bg-[#FF2E93]/10 border-[#FF2E93]/20 text-[#FF2E93]"
        }`}>
          <ShieldLock size={20} />
        </div>
        <h3 className="text-lg font-black tracking-tight text-white">
          {step === "create" ? "Придумай ПИН-код" : "Повтори ПИН-код"}
        </h3>
        <p className={`text-[11px] font-bold uppercase tracking-wide px-4 leading-normal transition-colors duration-300 ${
          isError ? "text-red-400" : "text-zinc-500"
        }`}>
          {subtitle}
        </p>
      </div>

      {/* Индикаторы ввода (Точки) */}
      <div className={`flex gap-4 my-6 transition-transform ${shake ? "animate-shake" : ""}`}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-150 ${
              isError
                ? "bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                : i < pin.length
                  ? "bg-[#FF2E93] border-[#FF2E93] shadow-[0_0_10px_rgba(255,46,147,0.5)] scale-110"
                  : "border-zinc-800 bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Сенсорная Клавиатура Финтех-уровня */}
      <div className="relative w-full px-2">
        <div className={`grid grid-cols-3 gap-x-6 gap-y-4 w-full transition-all duration-300 ${
          isLocked ? "opacity-30 blur-[2px] pointer-events-none" : "opacity-100 blur-0"
        }`}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleNumberInput(num)}
              className="h-14 w-14 rounded-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900/60 flex items-center justify-center text-lg font-black text-zinc-200 active:scale-90 transition-all cursor-pointer mx-auto"
            >
              {num}
            </button>
          ))}
          
          <div className="h-14 w-14" />
          
          <button
            key="0"
            type="button"
            onClick={() => handleNumberInput("0")}
            className="h-14 w-14 rounded-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900/60 flex items-center justify-center text-lg font-black text-zinc-200 active:scale-90 transition-all cursor-pointer mx-auto"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDeleteInput}
            className="h-14 w-14 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-300 active:scale-90 transition-all cursor-pointer mx-auto"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Невидимый физический щит */}
        {isLocked && <div className="absolute inset-0 z-50 bg-transparent" />}
      </div>

    </div>
  )
}
