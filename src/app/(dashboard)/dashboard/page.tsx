'use client'

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, ArrowDownLeft, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

import { BalanceSection } from "./_components/BalanceSection"
import { AddressCard } from "./_components/AddressCard"
import { ActivityList } from "./_components/ActivityList"
import { BackupCard } from "./_components/BackupCard"
import { UnlockPinForm } from "./_components/UnlockPinForm"
import { ReceiveModal } from "./_components/ReceiveModal"

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут активности

export default function DashboardPage() {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [mnemonic, setMnemonic] = useState("")
  
  const [isVerifying, setIsVerifying] = useState(true)
  const [isScreenLocked, setIsScreenLocked] = useState(false)

  // Функция принудительной блокировки
  const lockProfile = useCallback(() => {
    sessionStorage.removeItem("xcha_session_expires") // Стираем токен доступа из памяти сессии
    setIsScreenLocked(true)
  }, [])

  // Функция успешной разблокировки (вызывается из UnlockPinForm)
  const handleUnlockSuccess = useCallback(() => {
    const expiryTime = Date.now() + INACTIVITY_TIMEOUT
    sessionStorage.setItem("xcha_session_expires", expiryTime.toString()) // Записываем новый токен
    setIsScreenLocked(false)
  }, [])

  // Первичная проверка при загрузке страницы или при нажатии F5
  useEffect(() => {
    const isAuth = localStorage.getItem("xcha_is_auth")
    const savedMnemonic = localStorage.getItem("xcha_mnemonic")
    
    if (isAuth !== "true" || !savedMnemonic) {
      window.location.href = "/"
      return
    }

    setMnemonic(savedMnemonic)

    // Проверяем токен сессии в sessionStorage (он выдерживает F5)
    const sessionExpires = sessionStorage.getItem("xcha_session_expires")
    const now = Date.now()

    if (!sessionExpires || now > parseInt(sessionExpires, 10)) {
      // Если токена нет или его время вышло — открываем дашборд СРАЗУ ЗАКРЫТЫМ
      setIsScreenLocked(true)
    } else {
      // Если токен еще валиден (например, пользователь обновил страницу внутри 5 минут активности) — продлеваем его
      const expiryTime = now + INACTIVITY_TIMEOUT
      sessionStorage.setItem("xcha_session_expires", expiryTime.toString())
    }

    setIsVerifying(false)
  }, [])

  // Контроль афк и сворачивания вкладки
  useEffect(() => {
    if (isVerifying || isScreenLocked) return

    let timeoutId: NodeJS.Timeout

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId)
      
      // При каждом действии пользователя на странице обновляем время жизни сессии в sessionStorage
      const expiryTime = Date.now() + INACTIVITY_TIMEOUT
      sessionStorage.setItem("xcha_session_expires", expiryTime.toString())

      timeoutId = setTimeout(() => {
        lockProfile() // Закрываем по таймеру
      }, INACTIVITY_TIMEOUT)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lockProfile() // Закрываем мгновенно при сворачивании вкладки
      }
    }

    window.addEventListener("mousemove", resetInactivityTimer)
    window.addEventListener("keydown", resetInactivityTimer)
    window.addEventListener("touchstart", resetInactivityTimer)
    window.addEventListener("click", resetInactivityTimer)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    resetInactivityTimer()

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("mousemove", resetInactivityTimer)
      window.removeEventListener("keydown", resetInactivityTimer)
      window.removeEventListener("touchstart", resetInactivityTimer)
      window.removeEventListener("click", resetInactivityTimer)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [isVerifying, isScreenLocked, lockProfile])

  // Хардкод-данные
  const balanceXCH = "14.8520"
  const balanceUSD = "≈ $29.70 USD"
  const walletAddress = "xch1u48yq7gq59m7p3w9lx6p47vnm6w32q0lny8z490wxa56k7"

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1200)
  }

  const handleLogOut = () => {
    localStorage.removeItem("xcha_mnemonic")
    localStorage.removeItem("xcha_is_auth")
    sessionStorage.removeItem("xcha_session_expires")
    window.location.href = "/"
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Неоновый пульсирующий фон под лоадером */}
        <div className="absolute w-[250px] h-[250px] bg-[#FF2E93]/10 blur-[80px] rounded-full animate-pulse pointer-events-none" />
        
        {/* Логотип кошелька с мягким мерцанием */}
        <div className="relative z-10 bg-white text-black font-black text-xl px-5 py-2.5 rounded-2xl tracking-tight shadow-2xl select-none">
          XCH<span className="text-[#FF2E93]">A</span>
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF2E93] border-2 border-zinc-950" />
        </div>
      </div>
    )
  }

  // 2. ВТОРАЯ ПРОВЕРКА: если сессия протухла, рендерим ТОЛЬКО форму ввода пин-кода (без дашборда под ней!)
  if (isScreenLocked) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-25%] left-[-20%] w-[140%] h-[70vh] bg-gradient-to-br from-[#FF2E93]/20 via-[#8B5CF6]/10 to-transparent blur-[130px] pointer-events-none z-0" />
        <UnlockPinForm onSuccess={handleUnlockSuccess} />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white font-sans antialiased overflow-hidden flex flex-col justify-between">
      {/* Передаем функцию handleUnlockSuccess, чтобы она создавала токен при успехе */}
      {isScreenLocked && (
        <UnlockPinForm onSuccess={handleUnlockSuccess} />
      )}

      <div className="absolute top-[-10%] right-[-20%] w-[130%] h-[50vh] bg-gradient-to-bl from-[#B82EFF]/15 via-[#FF2E93]/5 to-transparent blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[80vw] h-[50vh] bg-[#FF2E93]/5 blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 flex-1 flex flex-col justify-between py-8">
        <div className="w-full space-y-6">
          
          <header className="flex items-center justify-between w-full pt-2">
            <div className="flex items-center gap-2">
              <div className="bg-white text-black font-black text-sm px-3 py-1.5 rounded-xl tracking-tight shadow-md select-none">
                XCH<span className="text-[#FF2E93]">A</span>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900/60 px-2.5 py-0.5 rounded-md border border-zinc-800 tracking-wider">
                MAINNET
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Онлайн
              </div>
              <button 
                onClick={handleLogOut}
                className="p-1.5 rounded-lg bg-zinc-900/40 border border-zinc-850 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer active:scale-95"
              >
                <LogOut size={13} />
              </button>
            </div>
          </header>

          <BalanceSection 
            balanceXCH={balanceXCH} 
            balanceUSD={balanceUSD} 
            isRefreshing={isRefreshing} 
            onRefresh={handleRefresh} 
          />

          <div className="grid grid-cols-2 gap-3">
            <Button className="h-12 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 border-none shadow-lg cursor-pointer">
              <ArrowUpRight size={16} className="text-[#FF2E93]" />
              <span>ОТПРАВИТЬ</span>
            </Button>
            <Button 
              onClick={() => setIsReceiveOpen(true)}
              className="h-12 bg-zinc-900 hover:bg-zinc-850 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
            >
              <ArrowDownLeft size={16} className="text-emerald-400" />
              <span>ПОЛУЧИТЬ</span>
            </Button>
          </div>

          <AddressCard walletAddress={walletAddress} />
          <ActivityList />
          <BackupCard mnemonic={mnemonic} />

        </div>

        <footer className="w-full text-center pt-6">
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">XCHA Wallet • Защищено локальным шифрованием</p>
        </footer>
      </div>

      <ReceiveModal 
        isOpen={isReceiveOpen} 
        onClose={() => setIsReceiveOpen(false)} 
        walletAddress={walletAddress} 
      />
    </div>
  )
}
