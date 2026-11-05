'use client'

import { useCallback } from "react"
import { decryptMnemonic, deriveMasterPublicKey, encryptMnemonic } from "@/lib/utils/crypto"

// ИМПОРТЫ: Живые реактивные сторы
import { useSecureStore } from "@/store/useSecureStore"
import { useWalletSessionStore } from "@/store/useWalletSessessionStore"
import { globalUserSettingsStore } from "@/providers/UserSettnigsProvider"

const SESSION_TIMEOUT = 15 * 60 * 1000

export function useWalletAuth() {

  // ⚡ ВСПОМОГАТЕЛЬНЫЙ УТИЛИТНЫЙ МЕТОД: Автоматизирует управление глобальным лоадером верификации сессии
  const runWithLoader = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      useWalletSessionStore.getState().setVerifying(true)
      return await operation()
    } catch (error) {
      throw error // Прокидываем ошибку дальше в вызывающий код
    } finally {
      useWalletSessionStore.getState().setVerifying(false)
    }
  }

  // 🚀 НОВЫЙ МЕТОД ИНИЦИАЛИЗАЦИИ: Забрал на себя всю грязную логику из контроллера
  const initWalletState = useCallback(() => {
    const { hasWallet: diskHasWallet } = useSecureStore.getState()
    const { unhardenedPkHex: activePkHex, expiresAt } = useWalletSessionStore.getState()
    const sessionStore = useWalletSessionStore.getState()

    // Сразу гасим верификацию, если она висела
    sessionStore.setVerifying(false)

    if (!diskHasWallet) {
      sessionStore.setScreenLocked(false)
      sessionStore.setNoWalletMode(true)
      return "NO_WALLET"
    }

    if (!activePkHex || !expiresAt || Date.now() > expiresAt) {
      sessionStore.setScreenLocked(true)
      sessionStore.setNoWalletMode(false)
      return "NEED_UNLOCK"
    }

    sessionStore.setScreenLocked(false)
    sessionStore.setNoWalletMode(false)
    return "AUTHORIZED"
  }, [])

  const loginWithClearMnemonic = useCallback(async (clearMnemonic: string) => {
    return runWithLoader(async () => {
      const pubKey = await deriveMasterPublicKey(clearMnemonic)
      useWalletSessionStore.getState().startSession(pubKey, SESSION_TIMEOUT)
      globalUserSettingsStore?.getState().setIsAuth(true)
    })
  }, [])

  const createNewWallet = useCallback(async (rawPhrase: string, pinCode: string): Promise<void> => {
    return runWithLoader(async () => {
      let cleanPhrase: string | null = rawPhrase.trim().toLowerCase().replace(/\s+/g, " ")

      try {
        const wordsCount = cleanPhrase.split(" ").filter(Boolean).length
        if (wordsCount !== 24 && wordsCount !== 12) {
          throw new Error("Фраза повреждена: должно быть 12 или 24 слова")
        }

        const encryptedData = await encryptMnemonic(cleanPhrase, pinCode)
        useSecureStore.getState().saveEncryptedMnemonic(encryptedData)
        const pubKey = await deriveMasterPublicKey(cleanPhrase)
        useWalletSessionStore.getState().startSession(pubKey, SESSION_TIMEOUT)
        globalUserSettingsStore?.getState().setIsAuth(true)
      } catch (error) {
        console.error("❌ Ошибка при создании кошелька:", error)
        throw error
      } finally {
        cleanPhrase = null
      }
    })
  }, [])

  const unlockWithPin = useCallback(async (pinCode: string): Promise<boolean> => {
    return runWithLoader(async () => {
      let clearMnemonic: string | null = null
      try {
        const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStore.getState()
        if (!diskHasWallet || !encryptedMnemonic) throw new Error("WALLET_NOT_FOUND")

        clearMnemonic = await decryptMnemonic(encryptedMnemonic, pinCode)
        const pubKey = await deriveMasterPublicKey(clearMnemonic)

        useWalletSessionStore.getState().startSession(pubKey, SESSION_TIMEOUT)
        globalUserSettingsStore?.getState().setIsAuth(true)
        return true
      } catch (error) {
        console.error("❌ Неверный PIN-код:", error)
        return false
      } finally {
        clearMnemonic = null
      }
    })
  }, [])

  const getMnemonicForSigning = useCallback(async (pinCode: string): Promise<string> => {
    const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStore.getState()
    if (!diskHasWallet || !encryptedMnemonic) throw new Error("WALLET_NOT_FOUND")

    return await decryptMnemonic(encryptedMnemonic, pinCode)
  }, [])

  const endSession = useCallback(() => {
    useWalletSessionStore.getState().endSession()
  }, [])

  const hardResetWallet = useCallback(() => {
    // 🚀 МГНОВЕННЫЙ ПЕРЕХВАТЧИК: Переключаем в гостевой режим
    useWalletSessionStore.getState().setNoWalletMode(true)

    // Стираем зашифрованные данные с диска IndexedDB
    useSecureStore.getState().deleteWallet()

    // Очищаем ключи из оперативной памяти вкладки
    useWalletSessionStore.getState().endSession()

    // Сбрасываем легкую куку авторизации для сервера Next.js
    globalUserSettingsStore?.getState().setIsAuth(false)
  }, [])

  const updateSessionTimer = useCallback(() => {
    useWalletSessionStore.getState().updateActivity(SESSION_TIMEOUT)
  }, [])

  return {
    initWalletState,
    loginWithClearMnemonic,
    createNewWallet,
    unlockWithPin,
    getMnemonicForSigning,
    endSession,
    hardResetWallet,
    updateSessionTimer
  }
}
