'use client'

import { useState, useEffect, useCallback } from "react"
import { generateChiaAddressFromMnemonic } from "@/lib/chia-crypto"

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут активности

export function useWalletAuth(onDataLoaded: (address: string) => void) {
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [decryptedPhrase, setDecryptedPhrase] = useState<string>("")
  const [isVerifying, setIsVerifying] = useState(true)
  const [isScreenLocked, setIsScreenLocked] = useState(false)

  // Общая функция деривации (вычисляет адрес и отправляет наверх в page.tsx для загрузки баланса)
  const deriveAndLoad = useCallback(async (clearMnemonic: string) => {
    try {
      setDecryptedPhrase(clearMnemonic)
      
      // ЧИТАЕМ ФЛАГ ИЗ .ENV: преобразуем строковое "true" в чистый boolean
      const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
      
      // Передаем true или false в универсальный крипто-модуль
      const derivedAddress = await generateChiaAddressFromMnemonic(clearMnemonic, isTestnet)
      setWalletAddress(derivedAddress)

      // Запускаем загрузку баланса из блокчейна в page.tsx
      onDataLoaded(derivedAddress)
    } catch (err) {
      console.error("Ошибка деривации ключей Chia:", err)
    }
  }, [onDataLoaded])

  const lockProfile = useCallback(() => {
    sessionStorage.removeItem("xcha_session_expires")
    setDecryptedPhrase("")
    setIsScreenLocked(true) // Включаем экран ввода ПИН-кода
  }, [])

  // Эта функция вызывается, когда UnlockPinForm успешно расшифровала сид-фразу введенным ПИН-кодом
  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      // 1. Записываем новый токен жизни сессии в sessionStorage
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())

      // 2. Передаем полученную расшифрованную фразу в движок деривации адреса
      await deriveAndLoad(clearMnemonic)

      // 3. Открываем шторку сейфа
      setIsScreenLocked(false)
    } catch (error) {
      console.error("Ошибка при обработке успешного входа:", error)
    }
  }, [deriveAndLoad])

  // Первичная проверка при монтировании (F5 или первый заход)
  useEffect(() => {
    const isAuth = localStorage.getItem("xcha_is_auth")
    const savedMnemonic = localStorage.getItem("xcha_mnemonic")

    if (isAuth !== "true" || !savedMnemonic) {
      window.location.href = "/"
      return
    }

    const sessionExpires = sessionStorage.getItem("xcha_session_expires")
    const now = Date.now()

    if (!sessionExpires || now > parseInt(sessionExpires, 10)) {
      setIsScreenLocked(true) // Сессия просрочена — требуем ПИН
    } else {
      // Если страница обновилась через F5, стейты сбросились в пустые.
      // Для безопасности оперативки принудительно заставляем ввести ПИН заново, чтобы восстановить ключи.
      setIsScreenLocked(true)
    }

    setIsVerifying(false) 
  }, [])

  // Логика афк-таймера контроля бездействия пользователя
  useEffect(() => {
    if (isVerifying || isScreenLocked) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      clearTimeout(timeoutId)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      timeoutId = setTimeout(lockProfile, INACTIVITY_TIMEOUT)
    }

    const handleVisibility = () => { if (document.hidden) lockProfile() }

    window.addEventListener("mousemove", resetTimer)
    window.addEventListener("keydown", resetTimer)
    window.addEventListener("touchstart", resetTimer)
    window.addEventListener("click", resetTimer)
    document.addEventListener("visibilitychange", handleVisibility)

    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("mousemove", resetTimer)
      window.removeEventListener("keydown", resetTimer)
      window.removeEventListener("touchstart", resetTimer)
      window.removeEventListener("click", resetTimer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [isVerifying, isScreenLocked, lockProfile])

  return { walletAddress, decryptedPhrase, isVerifying, isScreenLocked, handleUnlockSuccess, deriveAndLoad }
}
