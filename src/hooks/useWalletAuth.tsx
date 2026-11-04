'use client'

import { useCallback } from "react"
import { useSecureStorage, useWalletSession } from "@/store/useWalletStore"
import { decryptMnemonic, deriveMasterPublicKey, encryptMnemonic } from "@/lib/utils/crypto"

const SESSION_TIMEOUT = 15 * 60 * 1000 // 15 минут

export function useWalletAuth() {
  const startSession = useWalletSession((state) => state.startSession)
  const updateActivity = useWalletSession((state) => state.updateActivity)
  const endSessionFromStore = useWalletSession((state) => state.endSession)
  const setVerifying = useWalletSession((state) => state.setVerifying)
  const setScreenLocked = useWalletSession((state) => state.setScreenLocked)

  const vault = useSecureStorage()

  const endSession = useCallback(() => {
    endSessionFromStore()
  }, [endSessionFromStore])

  const hardResetWallet = useCallback(() => {
    vault.deleteWallet()
    endSessionFromStore()
  }, [endSessionFromStore])

  const loginWithClearMnemonic = useCallback(async (clearMnemonic: string) => {
    try {
      setVerifying(true)
      const pubKey = await deriveMasterPublicKey(clearMnemonic)
      startSession(pubKey, SESSION_TIMEOUT)
    } finally {
      setVerifying(false)
    }
  }, [startSession, setVerifying])

  /**
   * 🛡️ Создание и шифрование кошелька с жесткой очисткой памяти
   */
  const createNewWallet = useCallback(async (rawPhrase: string, pinCode: string): Promise<void> => {
    setVerifying(true)

    let cleanPhrase: string | null = rawPhrase.trim().toLowerCase().replace(/\s+/g, " ")
    let pubKey: string | null = null
    let encryptedData: any = null

    try {
      const wordsCount = cleanPhrase.split(" ").filter(Boolean).length

      if (wordsCount !== 24 && wordsCount !== 12) {
        throw new Error("Фраза повреждена: должно быть 12 или 24 слова")
      }

      // 1. Криптографическое шифрование
      encryptedData = await encryptMnemonic(cleanPhrase, pinCode)

      // 2. Сохраняем на диск зашифрованный вольт
      vault.saveEncryptedMnemonic(encryptedData)

      // 3. Получаем публичный ключ для сессии
      pubKey = await deriveMasterPublicKey(cleanPhrase)

      // 4. Поднимаем сессию в RAM
      startSession(pubKey, SESSION_TIMEOUT)

    } catch (error) {
      console.error("❌ Ошибка при создании кошелька:", error)
      throw error
    } finally {
      // 🔥 ЖЕСТКАЯ ОЧИСТКА ПАМЯТИ: Стираем любые упоминания сырой фразы
      cleanPhrase = null
      pubKey = null
      encryptedData = null
      setVerifying(false)
    }
  }, [startSession, setVerifying, vault])

  /**
   * 🔓 Разблокировка экрана приложения через PIN
   */
  /**
  * 🔓 Разблокировка экрана приложения через PIN
  */
  const unlockWithPin = useCallback(async (pinCode: string): Promise<boolean> => {
    setVerifying(true)
    let clearMnemonic: string | null = null
    let pubKey: string | null = null
    try {
      const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStorage.getState()
      if (!diskHasWallet || !encryptedMnemonic) throw new Error("WALLET_NOT_FOUND")

      clearMnemonic = await decryptMnemonic(encryptedMnemonic, pinCode)
      pubKey = await deriveMasterPublicKey(clearMnemonic)

      startSession(pubKey, SESSION_TIMEOUT)
      return true
    } catch (error) {
      console.error("❌ Неверный PIN-код:", error)
      return false
    } finally {
      clearMnemonic = null
      pubKey = null
      setVerifying(false)
    }
  }, [startSession, setVerifying])


  /**
   * 🔐 Изолированное получение фразы для подписи транзакций
   */
  const getMnemonicForSigning = useCallback(async (pinCode: string): Promise<string> => {
    const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStorage.getState()
    if (!diskHasWallet || !encryptedMnemonic) throw new Error("WALLET_NOT_FOUND")

    return await decryptMnemonic(encryptedMnemonic, pinCode)
  }, [])

  /**
   * 🕒 Проверка состояния сессии при инициализации (ЧИСТАЯ ФУНКЦИЯ)
   * Возвращает статус строкой, не вызывая немедленных сайд-эффектов мутации Zustand
   */
  const checkInitialState = useCallback(() => {
    const { hasWallet: diskHasWallet } = useSecureStorage.getState()
    const { unhardenedPkHex: activePkHex, expiresAt } = useWalletSession.getState()

    // 1. Кошелька вообще нет на диске (IndexedDB / LocalStorage пуст)
    if (!diskHasWallet) {
      return "NO_WALLET"
    }

    // 2. Кошелек есть, но активная сессия в оперативной памяти пуста
    if (!activePkHex || !expiresAt) {
      return "NEED_UNLOCK"
    }

    // 3. Время сессии истекло по таймеру простоя
    if (Date.now() > expiresAt) {
      endSessionFromStore() // Сброс сессии в хранилище RAM
      return "NEED_UNLOCK"
    }

    // 4. Пользователь успешно авторизован, ключи в RAM
    return "AUTHORIZED"
  }, [endSessionFromStore])

  return {
    loginWithClearMnemonic,
    createNewWallet,
    unlockWithPin,
    getMnemonicForSigning,
    checkInitialState,
    endSession,
    hardResetWallet,
    updateSessionTimer: useCallback(() => updateActivity(SESSION_TIMEOUT), [updateActivity])
  }
}
