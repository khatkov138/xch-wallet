'use client'

import { useCallback } from "react"
import { useSecureStorage, useWalletSession } from "@/store/useWalletStore"
import { decryptMnemonic, deriveMasterPublicKey } from "@/utils/crypto"

export function useWalletAuth() {
  const isScreenLocked = useWalletSession((state) => state.isScreenLocked)
  const isVerifying = useWalletSession((state) => state.isVerifying)
  const unhardenedPkHex = useWalletSession((state) => state.unhardenedPkHex)
  const hasWallet = useSecureStorage((state) => state.hasWallet)

  const startSession = useWalletSession((state) => state.startSession)
  const setVerifying = useWalletSession((state) => state.setVerifying)
  const setScreenLocked = useWalletSession((state) => state.setScreenLocked)
  const endSession = useWalletSession((state) => state.endSession)
  
  // 🔥 Достаем метод удаления кошелька с диска
  const deleteWallet = useSecureStorage((state) => state.deleteWallet)

  /**
   * 1. ВХОД С ЧИСТОЙ ФРАЗОЙ
   */
  const loginWithClearMnemonic = useCallback(async (clearMnemonic: string) => {
    try {
      setVerifying(true)
      const pubKey = await deriveMasterPublicKey(clearMnemonic)
      startSession(pubKey)
    } catch (error: any) {
      console.error("❌ Ошибка при создании сессии:", error)
      throw new Error(error.message || "Не удалось запустить сессию кошелька")
    } finally {
      setVerifying(false)
    }
  }, [startSession, setVerifying])

  /**
   * 2. РАСШИФРОВКА И ВХОД ПО ПИНУ
   */
  const unlockWithPin = useCallback(async (pinCode: string): Promise<boolean> => {
    try {
      setVerifying(true)
      const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStorage.getState()

      if (!diskHasWallet || !encryptedMnemonic) {
        throw new Error("Кошелек не найден на этом устройстве")
      }

      const clearMnemonic = await decryptMnemonic(encryptedMnemonic, pinCode)
      await loginWithClearMnemonic(clearMnemonic)
      return true
    } catch (error: any) {
      console.error("❌ Ошибка разблокировки:", error.message)
      throw error 
    } finally {
      setVerifying(false)
    }
  }, [loginWithClearMnemonic, setVerifying])

  /**
   * 3. ГЛОБАЛЬНАЯ ПРОВЕРКА СОСТОЯНИЯ
   */
  const checkInitialState = useCallback(() => {
    const { hasWallet: diskHasWallet } = useSecureStorage.getState()
    const { unhardenedPkHex: activePkHex } = useWalletSession.getState()

    if (!diskHasWallet) {
      setScreenLocked(false)
      setVerifying(false) 
      return "NO_WALLET"
    }

    if (!activePkHex) {
      setScreenLocked(true) 
      setVerifying(false)   
      return "NEED_UNLOCK"
    }

    setScreenLocked(false)
    setVerifying(false) 
    return "AUTHORIZED"
  }, [setVerifying, setScreenLocked])

  /**
   * 4. 🔥 ПОЛНЫЙ СБРОС С КЛИЕНТА (Методы сторов вызываются только тут)
   */
  const hardResetWallet = useCallback(() => {
    deleteWallet() // Стираем зашифрованную фразу с диска (localStorage)
    endSession()   // Обнуляем оперативку активной сессии (sessionStorage)
  }, [deleteWallet, endSession])

  return {
    loginWithClearMnemonic,
    unlockWithPin,
    checkInitialState,
    endSession,
    hardResetWallet, // 👈 Отдаем наружу одну готовую функцию полного сброса
    
    hasWallet,
    isScreenLocked,
    isVerifying,
    unhardenedPkHex
  }
}
