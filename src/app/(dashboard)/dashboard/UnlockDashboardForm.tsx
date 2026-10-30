'use client'

import React, { useState } from "react"
import { PinCodeLayout } from "@/components/PinCodeLayout"
import { useWalletAuth } from "@/hooks/useWalletAuth" // Твой понятный хук
import { useSecureStorage, useWalletSession } from "@/store/useWalletStore" // Наши сторы

export function UnlockDashboardForm() {
  // 1. Достаем метод разблокировки по ПИН-коду из хука
  const { unlockWithPin } = useWalletAuth()
  
  // Достаем методы очистки для полного сброса кошелька
  const vault = useSecureStorage()
  const session = useWalletSession()

  const [shake, setShake] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [subtitle, setSubtitle] = useState("Введи ПИН-код для подтверждения сессии и защиты ваших активов")

  // Сброс кошелька, если пользователь забыл ПИН-код (теперь красиво через Zustand)
  const handleResetWallet = () => {
    if (confirm("Вы уверены? Это полностью сотрет кошелек с этого устройства!")) {
      vault.deleteWallet() // Стирает зашифрованную мнемонику из localStorage
      session.endSession() // Очищает активную сессию из sessionStorage
      
      // Выкидываем на страницу авторизации/создания
      window.location.href = "/auth"
    }
  }

  const handlePinComplete = async (pin: string, clearPin: () => void) => {
    setIsLocked(true)

    // Небольшая задержка для плавности анимации ввода последней цифры
    await new Promise(resolve => setTimeout(resolve, 300))

    try {
      // 🔥 Вызываем единую бизнес-логику из хука. 
      // Она сама расшифрует мнемонику, поднимет сессию в Zustand и закроет экран блокировки.
      await unlockWithPin(pin)
      
    } catch (e) {
      console.error("❌ Ошибка разблокировки экрана через хук:", e)

      setIsError(true)
      setShake(true)
      setSubtitle("Неверный ПИН-код! Попробуй еще раз")

      setTimeout(() => setShake(false), 300)
      setTimeout(() => {
        setIsError(false)
        setIsLocked(false)
        clearPin()
        setSubtitle("Введи ПИН-код для подтверждения сессии и защиты ваших активов")
      }, 1200)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
      <div className="h-[480px] w-full">
        <PinCodeLayout
          title="Сейф закрыт"
          subtitle={subtitle}
          isError={isError}
          isLocked={isLocked}
          shake={shake}
          onPinComplete={handlePinComplete}
          footer={
            <button
              type="button"
              onClick={handleResetWallet}
              className="mt-4 flex items-center gap-1.5 text-[10px] font-black text-zinc-500 hover:text-[#FF2E93] active:scale-95 transition-all uppercase tracking-widest cursor-pointer py-2 px-4 rounded-xl hover:bg-zinc-900/40 mx-auto"
            >
              Забыли ПИН-код или сменить сейф?
            </button>
          }
        />
      </div>
    </div>
  )
}
