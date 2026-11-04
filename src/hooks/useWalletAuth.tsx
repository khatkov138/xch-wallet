'use client'

import { useCallback } from "react"
import { useSecureStorage, useWalletSession } from "@/store/useWalletStore"
import { decryptMnemonic, deriveMasterPublicKey, encryptMnemonic } from "@/lib/utils/crypto"

const SESSION_TIMEOUT = 15 * 60 * 1000

export function useWalletAuth() {
  const loginWithClearMnemonic = useCallback(async (clearMnemonic: string) => {
    try {
      useWalletSession.getState().setVerifying(true)
      const pubKey = await deriveMasterPublicKey(clearMnemonic)
      useWalletSession.getState().startSession(pubKey, SESSION_TIMEOUT)
    } finally {
      useWalletSession.getState().setVerifying(false)
    }
  }, [])

  const createNewWallet = useCallback(async (rawPhrase: string, pinCode: string): Promise<void> => {
    useWalletSession.getState().setVerifying(true)
    let cleanPhrase: string | null = rawPhrase.trim().toLowerCase().replace(/\s+/g, " ")
    let pubKey: string | null = null
    let encryptedData: any = null

    try {
      const wordsCount = cleanPhrase.split(" ").filter(Boolean).length
      if (wordsCount !== 24 && wordsCount !== 12) {
        throw new Error("Фраза повреждена: должно быть 12 или 24 слова")
      }

      encryptedData = await encryptMnemonic(cleanPhrase, pinCode)
      useSecureStorage.getState().saveEncryptedMnemonic(encryptedData)
      pubKey = await deriveMasterPublicKey(cleanPhrase)
      useWalletSession.getState().startSession(pubKey, SESSION_TIMEOUT)
    } catch (error) {
      console.error("❌ Ошибка при создании кошелька:", error)
      throw error
    } finally {
      cleanPhrase = null
      pubKey = null
      encryptedData = null
      useWalletSession.getState().setVerifying(false)
    }
  }, [])

  const unlockWithPin = useCallback(async (pinCode: string): Promise<boolean> => {
    useWalletSession.getState().setVerifying(true)
    let clearMnemonic: string | null = null
    let pubKey: string | null = null
    try {
      const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStorage.getState()
      if (!diskHasWallet || !encryptedMnemonic) throw new Error("WALLET_NOT_FOUND")

      clearMnemonic = await decryptMnemonic(encryptedMnemonic, pinCode)
      pubKey = await deriveMasterPublicKey(clearMnemonic)

      useWalletSession.getState().startSession(pubKey, SESSION_TIMEOUT)
      return true
    } catch (error) {
      console.error("❌ Неверный PIN-код:", error)
      return false
    } finally {
      clearMnemonic = null
      pubKey = null
      useWalletSession.getState().setVerifying(false)
    }
  }, [])

  const getMnemonicForSigning = useCallback(async (pinCode: string): Promise<string> => {
    const { hasWallet: diskHasWallet, encryptedMnemonic } = useSecureStorage.getState()
    if (!diskHasWallet || !encryptedMnemonic) throw new Error("WALLET_NOT_FOUND")

    return await decryptMnemonic(encryptedMnemonic, pinCode)
  }, [])

  const checkInitialState = useCallback(() => {
    const { hasWallet: diskHasWallet } = useSecureStorage.getState()
    const { unhardenedPkHex: activePkHex, expiresAt } = useWalletSession.getState()

    if (!diskHasWallet) return "NO_WALLET"
    if (!activePkHex || !expiresAt || Date.now() > expiresAt) return "NEED_UNLOCK"

    return "AUTHORIZED"
  }, [])

  const endSession = useCallback(() => {
    useWalletSession.getState().endSession()
  }, [])

  const hardResetWallet = useCallback(() => {
    useSecureStorage.getState().deleteWallet()
    useWalletSession.getState().endSession()
  }, [])

  const updateSessionTimer = useCallback(() => {
    // 🛡️ Фикс: Вызов через метод .getState() полностью изолирует зависимость от реактивного Zustand-стейта
    useWalletSession.getState().updateActivity(SESSION_TIMEOUT)
  }, [])

  return {
    loginWithClearMnemonic,
    createNewWallet,
    unlockWithPin,
    getMnemonicForSigning,
    checkInitialState,
    endSession,
    hardResetWallet,
    updateSessionTimer
  }
}
