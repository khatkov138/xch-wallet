'use client'

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { PinCodeLayout } from "@/components/PinCodeLayout"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletSession } from "@/store/useWalletStore"

export function UnlockPinForm() {
  const router = useRouter()
  
  // 1. ДИСПЕТЧЕР (Только экшены, 0 ререндеров)
  const { unlockWithPin, hardResetWallet } = useWalletAuth()

  // 2. ДАТЧИК (Реактивная крутилка из стора вместо локального isLocked)
  const isVerifying = useWalletSession((state) => state.isVerifying)

  //Локальные стейты только для визуальных эффектов анимации
  const [shake, setShake] = useState(false)
  const [isError, setIsError] = useState(false)
  const [subtitle, setSubtitle] = useState("Введи ПИН-код для подтверждения сессии и защиты активов")

  const handleResetWallet = () => {
    hardResetWallet()
    router.push("/auth")
  }

  const handlePinComplete = async (pin: string, clearPin: () => void) => {
    try {
      setIsError(false)
      setSubtitle("Проверяем ПИН-код...")
      
      await unlockWithPin(pin)
      
      // При успешном входе Zustand сменит `isScreenLocked`, и DashboardClient сам размонтирует эту форму
    } catch (e) {
      console.error("❌ Ошибка разблокировки:", e)

      // Включаем анимацию тряски и ошибку
      setIsError(true)
      setShake(true)
      setSubtitle("Неверный ПИН-код! Попробуй еще раз")
      clearPin()

      // Для сброса анимации тряски используем нативное событие окончания анимации (onAnimationEnd) 
      // или декларативный сброс, но здесь для сброса класса эффекта достаточно переключить стейт назад
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
      <div 
        className="h-[480px] w-full"
        // 🛡️ Чистый сброс анимации тряски без setTimeout: как только она отработала, убираем класс
        onAnimationEnd={() => setShake(false)} 
      >
        <PinCodeLayout
          title="Сейф закрыт"
          subtitle={subtitle}
          isError={isError}
          isLocked={isVerifying} // Используем глобальный статус верификации из стора
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
