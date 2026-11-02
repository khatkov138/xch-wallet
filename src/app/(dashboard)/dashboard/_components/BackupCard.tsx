'use client'

import React, { useState, useEffect, useRef } from "react"
import { Copy, Check, Eye, EyeOff, ShieldAlert, Printer, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PapperWalletPrintout } from "@/components/PapperWalletPrintout"

// 🎯 ИМПОРТ: Подключаем твой хук авторизации
import { useWalletAuth } from "@/hooks/useWalletAuth" 

export function BackupCard() {
  // Вызываем хук и забираем изолированный крипто-метод
  const { getMnemonicForSigning } = useWalletAuth()

  // Локальные стейты для логики показа и валидации
  const [mnemonic, setMnemonic] = useState<string>("")
  const [showSeed, setShowSeed] = useState(false)
  const [copiedSeed, setCopiedSeed] = useState(false)
  
  // Состояния для проверки ПИН-кода
  const [isPinStep, setIsPinStep] = useState(false)
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [pinError, setPinError] = useState("")

  const formRef = useRef<HTMLFormElement>(null)

  // Валидация: проверяем, что в полученной строке ровно 24 слова
  const isMnemonicValid24Words = mnemonic && mnemonic.trim().split(/\s+/).length === 24

  // Очищаем фразу из памяти компонента, когда пользователь скрывает её назад
  useEffect(() => {
    if (!showSeed) {
      setMnemonic("")
      setPin("")
      setIsPinStep(false)
      setPinError("")
    }
  }, [showSeed])

  const copySeedPhrase = () => {
    if (!isMnemonicValid24Words) return
    navigator.clipboard.writeText(mnemonic)
    setCopiedSeed(true)
    setTimeout(() => setCopiedSeed(false), 2000)
  }

  // Обработка клика на иконку Глаза
  const handleToggleEye = () => {
    if (showSeed) {
      setShowSeed(false)
    } else {
      setIsPinStep(!isPinStep)
    }
  }

  // 🔥 ИНТЕГРАЦИЯ: Валидация ПИН-кода через метод твоего хука
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length !== 6) return 

    setLoading(true)
    setPinError("")

    try {
      console.log("🔐 Вызов изолированного метода дешифрации...")
      
      // Передаем пин-код в твой метод. Если пин неверный, decryptMnemonic внутри хука выбросит ошибку, и мы упадем в блок catch
      const decryptedMnemonic = await getMnemonicForSigning(pin)

      console.log("✅ Успешно расшифровано!")
      setMnemonic(decryptedMnemonic)
      setShowSeed(true)
      setIsPinStep(false)
    } catch (err: any) {
      console.error("❌ Ошибка расшифровки сида по ПИН-коду:", err)
      // Сюда прилетит либо "WALLET_NOT_FOUND", либо ошибка неверного ПИНа из твоего crypto-модуля
      setPinError("Неверный ПИН-код")
      setPin("")
    } finally {
      setLoading(false)
    }
  }

  // Контроллер ввода: фильтрует цифры и делает авто-сабмит на 6-м знаке
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "") 
    if (val.length <= 6) {
      setPin(val)
    }

    if (val.length === 6) {
      setTimeout(() => {
        if (formRef.current) {
          formRef.current.requestSubmit()
        }
      }, 50)
    }
  }

  return (
    <>
      <Card className="bg-zinc-900/30 border border-zinc-900 rounded-[24px] shadow-xl overflow-hidden print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400/90">
              <ShieldAlert size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Резервная копия</span>
            </div>

            <div className="flex items-center gap-2">
              {showSeed && isMnemonicValid24Words && (
                <button
                  onClick={() => window.print()}
                  className="text-zinc-400 hover:text-white px-2 py-1 rounded-md bg-zinc-950 text-[10px] font-bold border border-zinc-850 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  <Printer size={12} className="text-[#FF2E93]" />
                  <span>Печать / PDF</span>
                </button>
              )}

              <button
                onClick={handleToggleEye}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                {showSeed ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showSeed ? "Скрыть" : isPinStep ? "Отмена" : "Показать фразу"}</span>
              </button>

              {showSeed && isMnemonicValid24Words && (
                <button
                  onClick={copySeedPhrase}
                  className="text-zinc-400 hover:text-white px-2 py-0.5 rounded-md bg-zinc-950 text-[10px] font-mono border border-zinc-850 flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedSeed ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  <span>{copiedSeed ? "ОК" : "Copy Seed"}</span>
                </button>
              )}
            </div>
          </div>

          {/* ЭТАП 1: Фраза успешно открыта и валидна */}
          {showSeed && !isPinStep && (
            <div className="p-3 bg-zinc-950/80 border border-zinc-900 rounded-xl font-mono text-[11px] text-zinc-400 leading-relaxed tracking-tight select-all">
              {isMnemonicValid24Words ? mnemonic : "Ошибка: Мнемоника повреждена или не содержит 24 слова"}
            </div>
          )}

          {/* ЭТАП 2: Запрос ПИН-кода */}
          {!showSeed && isPinStep && (
            <form ref={formRef} onSubmit={handleVerifyPin} className="p-3 bg-zinc-950/50 border border-zinc-900 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-semibold text-zinc-400 whitespace-nowrap">Введите ПИН для доступа:</span>
                <div className="relative flex-1 max-w-[140px]">
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="••••••"
                    value={pin}
                    onChange={handlePinChange}
                    disabled={loading}
                    autoFocus
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-center tracking-widest focus:outline-none focus:border-[#FF2E93] text-white"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || pin.length !== 6}
                  className="bg-white text-black text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-all disabled:opacity-40 shrink-0 cursor-pointer min-w-[60px] flex items-center justify-center"
                >
                  {loading ? <Loader2 size={10} className="animate-spin" /> : "ОК"}
                </button>
              </div>
              {pinError && (
                <div className="text-[9px] text-rose-500 font-medium pl-1 text-right">
                  {pinError}
                </div>
              )}
            </form>
          )}

          {/* ЭТАП 3: Фраза скрыта (заглушка) */}
          {!showSeed && !isPinStep && (
            <div 
              onClick={() => setIsPinStep(true)}
              className="p-3 bg-zinc-950/30 border border-zinc-900/60 rounded-xl flex items-center justify-center text-[10px] text-zinc-600 font-bold uppercase tracking-wider select-none py-4 cursor-pointer hover:bg-zinc-950/50 transition-colors"
            >
              •••• •••• •••• •••• •••• ••••
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🛡️ КРИТИЧЕСКИЙ ФИКС БЕЗОПАСНОСТИ: В DOM рендерится только при успешном ПИНе и ровно 24 словах */}
      {showSeed && isMnemonicValid24Words && (
        <PapperWalletPrintout mnemonic={mnemonic} />
      )}
    </>
  )
}
