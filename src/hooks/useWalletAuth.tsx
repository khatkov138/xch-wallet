'use client'

import { useCallback } from "react"
import { useSecureStorage, useWalletSession } from "@/store/useWalletStore"
import { decryptMnemonic, deriveMasterPublicKey } from "@/utils/crypto"

export function useWalletAuth() {
  // 1. РЕАКТИВНЫЕ СТЕНТЫ (через правильные селекторы, чтобы не было лавины ререндеров)
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const isVerifying = useWalletSession((state) => state.isVerifying)
  const unhardenedPkHex = useWalletSession((state) => state.unhardenedPkHex)
  const hasWallet = useSecureStorage((state) => state.hasWallet)

  // 2. ФУНКЦИИ-ЭКШЕНЫ ИЗ СТОРОВ
  const startSession = useWalletSession((state) => state.startSession)
  const setVerifying = useWalletSession((state) => state.setVerifying)
  const setScreenLocked = useWalletSession((state) => state.setScreenLocked)
  const endSession = useWalletSession((state) => state.endSession)

  /**
   * 1. ВХОД С ЧИСТОЙ ФРАЗОЙ (При создании кошелька)
   */
  const loginWithClearMnemonic = useCallback(async (clearMnemonic: string) => {
    try {
      setVerifying(true)

      // Генерируем реальный Chia BLS Master Public Key
      const pubKey = await deriveMasterPublicKey(clearMnemonic)

      // Пишем ключ в Zustand сессию
      startSession(pubKey)
    } catch (error: any) {
      console.error("❌ Ошибка при создании сессии:", error)
      throw new Error(error.message || "Не удалось запустить сессию кошелька")
    } finally {
      setVerifying(false)
    }
  }, [startSession, setVerifying])

  /**
   * 2. РАСШИФРОВКА И ВХОД ПО ПИНУ (При возвращении в приложение)
   */
  const unlockWithPin = useCallback(async (pinCode: string): Promise<boolean> => {
    try {
      setVerifying(true)

      // Читаем снимок стора без подписки на ререндер
      const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStorage.getState()

      if (!diskHasWallet || !encryptedMnemonic) {
        throw new Error("Кошелек не найден на этом устройстве")
      }

      // Расшифровываем строку через утилиты
      const clearMnemonic = await decryptMnemonic(encryptedMnemonic, pinCode)

      // Логинимся
      await loginWithClearMnemonic(clearMnemonic)
      return true
    } catch (error: any) {
      console.error("❌ Ошибка разблокировки:", error.message)
      throw error // Кидаем ошибку для анимации тряски (shake) в форме
    } finally {
      setVerifying(false)
    }
  }, [loginWithClearMnemonic, setVerifying])

  /**
   * 3. ГЛОБАЛЬНАЯ ПРОВЕРКА СОСТОЯНИЯ (Для useEffect на Дашборде)
   */
  const checkInitialState = useCallback(() => {
    const { hasWallet: diskHasWallet } = useSecureStorage.getState()
    const { unhardenedPkHex: activePkHex } = useWalletSession.getState()

    if (!diskHasWallet) {
      setVerifying(false)
      setScreenLocked(false)
      return "NO_WALLET"
    }

    if (!activePkHex) {
      setScreenLocked(true)
      setVerifying(false)
      return "NEED_UNLOCK"
    }

    setVerifying(false)
    return "AUTHORIZED"
  }, [setVerifying, setScreenLocked])

  // Возвращаем ВСЕ поля, которые нужны твоим формам и страницам кошелька
  return {
    // Методы
    loginWithClearMnemonic,
    unlockWithPin,
    checkInitialState,
    endSession,
    
    // Стейты
    hasWallet,
    isScreenLocked,
    isVerifying,
    unhardenedPkHex
  }
}
