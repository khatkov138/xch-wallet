'use client'

import { useCallback } from "react"
import { useSecureStorage, useWalletSession } from "@/store/useWalletStore"
import { decryptMnemonic, deriveMasterPublicKey } from "@/lib/utils/crypto"

const SESSION_TIMEOUT = 15 * 60 * 1000 // 15 минут

export function useWalletAuth() {
  const startSession = useWalletSession((state) => state.startSession)
  const updateActivity = useWalletSession((state) => state.updateActivity)
  const endSessionFromStore = useWalletSession((state) => state.endSession)
  const setVerifying = useWalletSession((state) => state.setVerifying)
  const setScreenLocked = useWalletSession((state) => state.setScreenLocked)

  const deleteWallet = useSecureStorage((state) => state.deleteWallet)

  const endSession = useCallback(() => {
    endSessionFromStore()
  }, [endSessionFromStore])

  const hardResetWallet = useCallback(() => {
    deleteWallet()
    endSessionFromStore()
  }, [deleteWallet, endSessionFromStore])

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
   * 🛡️ МЕТОД 1: Только для разблокировки экрана приложения
   */
  const unlockWithPin = useCallback(async (pinCode: string): Promise<boolean> => {
    setVerifying(true)
    try {
      const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStorage.getState()
      if (!diskHasWallet || !encryptedMnemonic) throw new Error("WALLET_NOT_FOUND")

      const clearMnemonic = await decryptMnemonic(encryptedMnemonic, pinCode)
      const pubKey = await deriveMasterPublicKey(clearMnemonic)

      startSession(pubKey, SESSION_TIMEOUT)
      return true
    } finally {
      setVerifying(false)
    }
  }, [startSession, setVerifying])

  /**
   * 🔐 МЕТОД 2: Изолированное получение фразы для подписи транзакций
   * Не дергает глобальные лоадеры, не вызывает побочных эффектов на Дашборде
   */
  const getMnemonicForSigning = useCallback(async (pinCode: string): Promise<string> => {
    const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStorage.getState()
    if (!diskHasWallet || !encryptedMnemonic) throw new Error("WALLET_NOT_FOUND")

    return await decryptMnemonic(encryptedMnemonic, pinCode)
  }, [])

  const checkInitialState = useCallback(() => {
    const { hasWallet: diskHasWallet } = useSecureStorage.getState()
    const { unhardenedPkHex: activePkHex, expiresAt } = useWalletSession.getState()

    if (!diskHasWallet) {
      setScreenLocked(false)
      setVerifying(false)
      return "NO_WALLET"
    }

    if (!activePkHex || !expiresAt) {
      setScreenLocked(true)
      setVerifying(false)
      return "NEED_UNLOCK"
    }

    if (Date.now() > expiresAt + 2000) {
      endSessionFromStore()
      return "NEED_UNLOCK"
    }

    setScreenLocked(false)
    setVerifying(false)
    return "AUTHORIZED"
  }, [setScreenLocked, setVerifying, endSessionFromStore])

  return {
    loginWithClearMnemonic,
    unlockWithPin,
    getMnemonicForSigning, // Новый чистый метод
    checkInitialState,
    endSession,
    hardResetWallet,
    updateSessionTimer: useCallback(() => updateActivity(SESSION_TIMEOUT), [updateActivity])
  }
}
