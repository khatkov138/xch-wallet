'use client'

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Delete, ShieldLock } from "lucide-react"
import { decryptMnemonic } from "@/lib/crypto"

interface UnlockPinFormProps {
  // ФИКС: Изменили имя на onUnlock, чтобы оно идеально стыковалось с вызовом в page.tsx
  onUnlock: (decryptedMnemonic: string) => void
}

export function UnlockPinForm({ onUnlock }: UnlockPinFormProps) {
  const [pin, setPin] = useState("")
  const [shake, setShake] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  // Реф для безопасного хранения тайм-аута разблокировки
  const unlockTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleNumberClick = useCallback((num: string) => {
    if (pin.length < 4 && !isLocked && !isError) {
      setPin(prev => prev + num)
    }
  }, [pin.length, isLocked, isError])

  const handleDelete = useCallback(() => {
    if (!isLocked && !isError) {
      setPin(prev => prev.slice(0, -1))
    }
  }, [isLocked, isError])

  const handleResetWallet = () => {
    localStorage.removeItem("xcha_mnemonic")
    localStorage.removeItem("xcha_is_auth")
    sessionStorage.removeItem("xcha_session_expires")
    window.location.href = "/"
  }

  // Нативный перехват физической клавиатуры
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return

      if (e.key >= "0" && e.key <= "9" && e.key.length === 1) {
        e.preventDefault()
        handleNumberClick(e.key)
      }
      else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault()
        handleDelete()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleNumberClick, handleDelete])

  // Эффект валидации ПИН-кода при заполнении 4 цифр
  useEffect(() => {
    if (pin.length === 4) {
      setIsLocked(true)

      unlockTimeoutRef.current = setTimeout(async () => {
        try {
          const encryptedData = localStorage.getItem("xcha_mnemonic") || ""
          // Расшифровываем сид введенным пином
          const decrypted = await decryptMnemonic(encryptedData, pin)

          // Отдаем чистую фразу в глобальный стор через хук useWalletAuth
          onUnlock(decrypted)
        } catch (e) {
          console.error("Ошибка расшифровки ПИН-кода:", e)
          setIsError(true)
          setShake(true)

          setTimeout(() => setShake(false), 300)
          setTimeout(() => {
            setIsError(false)
            setIsLocked(false)
            setPin("")
          }, 1200)
        }
      }, 300)
    }

    return () => {
      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current)
    }
  }, [pin, onUnlock])

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
      <div className="flex flex-col items-center justify-between h-[480px] w-full max-w-xs mx-auto">

        {/* Текстовый заголовок */}
        <div className="text-center space-y-2">
          <div className={`mx-auto h-10 w-10 border rounded-full flex items-center justify-center transition-colors duration-300 ${isError ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-[#FF2E93]/10 border-[#FF2E93]/20 text-[#FF2E93]"
            }`}>
            <ShieldLock size={20} />
          </div>
          <h3 className="text-lg font-black tracking-tight text-white">Сейф закрыт</h3>
          <p className={`text-[11px] font-bold uppercase tracking-wide transition-colors px-4 leading-normal ${isError ? "text-red-400" : "text-zinc-500"}`}>
            {isError ? "Неверный ПИН-код! Попробуй еще раз" : "Введи ПИН-код для подтверждения сессии и защиты ваших активов"}
          </p>
        </div>

        {/* Точки индикатора */}
        <div className={`flex gap-4 my-2 transition-transform ${shake ? "animate-shake" : ""}`}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-150 ${isError
                  ? "bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  : i < pin.length
                    ? "bg-[#FF2E93] border-[#FF2E93] shadow-[0_0_10px_rgba(255,46,147,0.5)] scale-110"
                    : "border-zinc-800 bg-transparent"
                }`}
            />
          ))}
        </div>

        {/* Интерактивная клавиатура */}
        <div className="relative w-full px-2">
          <div className={`grid grid-cols-3 gap-x-6 gap-y-4 w-full transition-all duration-300 ${isLocked ? "opacity-30 blur-[2px] pointer-events-none" : "opacity-100 blur-0"
            }`}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberClick(num)}
                className="h-14 w-14 rounded-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900/60 flex items-center justify-center text-lg font-black text-zinc-200 active:scale-90 transition-all cursor-pointer mx-auto"
              >
                {num}
              </button>
            ))}
            <div className="h-14 w-14" />
            <button
              type="button"
              onClick={() => handleNumberClick("0")}
              className="h-14 w-14 rounded-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900/60 flex items-center justify-center text-lg font-black text-zinc-200 active:scale-90 transition-all cursor-pointer mx-auto"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-14 w-14 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-300 active:scale-90 transition-all cursor-pointer mx-auto"
            >
              <Delete size={20} />
            </button>
          </div>
          {isLocked && <div className="absolute inset-0 z-50 bg-transparent" />}
        </div>

        {/* Лояльная финтех-фраза сброса */}
        <button
          type="button"
          onClick={handleResetWallet}
          className="mt-4 flex items-center gap-1.5 text-[10px] font-black text-zinc-500 hover:text-[#FF2E93] active:scale-95 transition-all uppercase tracking-widest cursor-pointer py-2 px-4 rounded-xl hover:bg-zinc-900/40"
        >
          <span>Забыли ПИН-код или сменить сейф?</span>
        </button>

      </div>
    </div>
  )
}
