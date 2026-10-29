'use client'

import { useEffect, useCallback, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useWalletStore } from "@/store/useWalletStore"
import { runCryptoAudit, decryptMnemonic } from "@/lib/crypto"
import chiaBls from 'chia-bls';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут
//const INACTIVITY_TIMEOUT = 10 * 1000 // 10sec
export function useWalletAuth() {
  const router = useRouter()
  const pathname = usePathname()

  const {
    unhardenedPkHex,
    isScreenLocked,
    isVerifying,
    setWalletData,
    setScreenLocked,
    setVerifying,
    clearStore
  } = useWalletStore()

  // Используем ref для таймаута, чтобы избежать лишних перезапусков эффекта
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Мгновенный геттер публичного ключа для TanStack Query
  const getUnhardenedPkHex = useCallback((): string | null => {
    return unhardenedPkHex || null
  }, [unhardenedPkHex])

  /**
   * 🔑 Получение приватного ключа по ПИН-коду "на лету" для подписи транзакций
   */
  /**
   * 🔑 Получение приватного ключа по ПИН-коду "на лету" с авто-деривацией индекса
   */
  const getSkHexByPin = useCallback(async (pin: string, branch: 2 | 3 = 3, index: number = 0): Promise<string> => {
    if (typeof window === 'undefined') throw new Error("Среда выполнения не определена")
    const encryptedMnemonic = localStorage.getItem("xcha_mnemonic")
    if (!encryptedMnemonic || encryptedMnemonic === "true") throw new Error("Кошелек не найден")

    try {
      const clearMnemonic = await decryptMnemonic(encryptedMnemonic, pin)
      const auditJson = runCryptoAudit(clearMnemonic)
      if (!auditJson) throw new Error("Не удалось восстановить ключи")
      const auditData = JSON.parse(auditJson)

      // 1. Если запрошена старая hardened-ветка 2 (например, для обычных транзакций)
      if (branch === 2) {
        return auditData.wallet_sk_hardened_hex
      }

      // 2. Если нужна unhardened-ветка 3 (для наших смарт-контрактов)
      // Восстанавливаем мастер-приватник 3-й ветки, который добавили в runCryptoAudit
      const masterSk3 = chiaBls.PrivateKey.fromHex(auditData.wallet_sk_unhardened_master_hex)

      // Деривируем дочерний ключ для конкретной монеты по её индексу
      const childSk = chiaBls.AugSchemeMPL.deriveChildSkUnhardened(masterSk3, index)

      return childSk.toHex()
    } catch (error) {
      console.error(error)
      throw new Error("Неверный ПИН-код или ошибка деривации")
    }
  }, [])


  /**
   * 🎉 Централизованный метод успешного входа (вызывается из EncryptPhraseForm или формы разблокировки)
   */
  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      const auditJson = runCryptoAudit(clearMnemonic)
      if (!auditJson) throw new Error("Критический сбой аудита ключей")
      const auditData = JSON.parse(auditJson)

      if (typeof window !== 'undefined') {
        sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      }

      // Записываем только публичные данные в Zustand (Приватный ключ НЕ храним в памяти!)
      setWalletData(auditData.unhardened_wallet_pk_hex)
      setScreenLocked(false)
    } catch (error) {
      console.error("❌ Ошибка авторизации:", error)
      throw error
    }
  }, [setWalletData, setScreenLocked])

  /**
   * 🔒 Блокировка кошелька (очистка сессии и Zustand)
   */
  const lockWallet = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem("xcha_session_expires")
    }
    clearStore()
  }, [clearStore])

  /**
   * 🔄 🔥 НОВЫЙ ВНУТРЕННИЙ МЕТОД: Валидация и разблокировка для UnlockPinForm
   * Достает данные, расшифровывает, проверяет на 24 слова и вызывает handleUnlockSuccess
   */
  const unlockWalletByPin = useCallback(async (pin: string): Promise<void> => {
    if (typeof window === 'undefined') throw new Error("Среда выполнения не определена")

    const encryptedData = localStorage.getItem("xcha_mnemonic") || ""
    if (!encryptedData || encryptedData === "true") {
      throw new Error("Кошелек не найден в хранилище")
    }

    // 1. Расшифровываем мнемонику
    const decrypted = await decryptMnemonic(encryptedData, pin)
    const cleanPhrase = decrypted.trim().toLowerCase().replace(/\s+/g, " ")

    // 2. 🛡 ЖЕСТКИЙ ФИЛЬТР: Проверяем количество слов
    const wordsCount = cleanPhrase.split(" ").filter(Boolean).length
    if (wordsCount !== 24) {
      throw new Error("Расшифрованная фраза повреждена или не содержит 24 слова")
    }

    // 3. Если всё ок — вызываем твой родной handleUnlockSuccess
    await handleUnlockSuccess(cleanPhrase)
  }, [handleUnlockSuccess])

  /**
   * 🔄 ЭФФЕКТ 1: Инициализация и проверка сессии при смене страниц
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const hasMnemonic = localStorage.getItem("xcha_mnemonic")
    const isAuthMark = localStorage.getItem("xcha_is_auth") === "true"

    // ЕСЛИ КОШЕЛЬКА НЕТ: отправляем на страницу авторизации (но только если мы уже не там!)
    if (!hasMnemonic || !isAuthMark) {
      if (pathname !== "/auth") {
        lockWallet()
        router.replace("/auth")
      }
      setVerifying(false)
      return
    }

    // ЕСЛИ КОШЕЛЕК ЕСТЬ: проверяем сессию активности
    const sessionExpires = sessionStorage.getItem("xcha_session_expires")
    const isSessionValid = sessionExpires && Date.now() < parseInt(sessionExpires, 10)

    if (isSessionValid && unhardenedPkHex) {
      setScreenLocked(false)
    } else {
      // Сессия истекла или данных нет в Zustand -> включаем экран блокировки ПИН-кодом
      setScreenLocked(true)
    }

    setVerifying(false)
  }, [pathname, unhardenedPkHex, lockWallet, setScreenLocked, setVerifying, router])

  /**
   * ⏱ ЭФФЕКТ 2: Таймер автоблокировки по неактивности пользователя
   */
  useEffect(() => {
    // Если экран уже заблокирован или идет проверка, таймер не нужен
    if (isVerifying || isScreenLocked || pathname === "/auth") return

    const resetTimer = () => {
      if (typeof window === 'undefined') return

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())

      timeoutRef.current = setTimeout(() => {
        lockWallet()
      }, INACTIVITY_TIMEOUT)
    }

    const events = ["mousemove", "keydown", "touchstart", "click"]
    events.forEach(e => window.addEventListener(e, resetTimer))

    // Инициализационный запуск таймера
    resetTimer()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [isVerifying, isScreenLocked, pathname, lockWallet])



  return {

    isVerifying,
    isScreenLocked,
    handleUnlockSuccess, // На месте для EncryptPhraseForm
    lockWallet,
    getUnhardenedPkHex,
    getSkHexByPin,
    unlockWalletByPin // На месте для UnlockPinForm
  }
}
