'use client'

import { useEffect, useCallback } from "react"
import { useWalletStore } from "@/store/useWalletStore"
import { runCryptoAudit, signTransactionSpends } from "@/lib/crypto"
import bip39 from 'bip39'
import chiaBls from 'chia-bls'

const { PrivateKey, AugSchemeMPL } = chiaBls

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут сессии
const CHIA_PORT = 12381
const CHIA_COIN = 8444

export function useWalletAuth() {
  const {
    walletAddress,
    decryptedPhrase,
    isScreenLocked,
    isVerifying,
    setWalletData,
    lockWallet,
    setVerifying,
    setScreenLocked
  } = useWalletStore()

  // 1. Метод криптографического аудита в консоль
  const logCryptoAudit = useCallback((clearMnemonic: string) => {
    return runCryptoAudit(clearMnemonic)
  }, [])

  // 2. Быстрое извлечение Unhardened Wallet PK Hex для питона
  const getUnhardenedPkHex = useCallback((): string | null => {
    if (!decryptedPhrase) {
      console.error("[ChiaCrypto] Ошибка: мнемоника отсутствует в памяти кошелька")
      return null
    }
    return runCryptoAudit(decryptedPhrase)
  }, [decryptedPhrase])

  // 3. ИСПРАВЛЕНО: Каноническое извлечение Hardened Wallet SK Hex по стандарту CHIP-0002
  const getUnhardenedSkHex = useCallback((): string | null => {
    try {
      if (!decryptedPhrase) {
        console.error("[ChiaCrypto] Ошибка: мнемоника отсутствует в памяти кошелька")
        return null
      }
      const seed = bip39.mnemonicToSeedSync(decryptedPhrase.trim())
      const masterSk = PrivateKey.fromSeed(seed)

      // Возвращаем СЫРОЙ Master SK в Big-Endian формате, чтобы Python прочитал его корректно
      const masterSkBytes = masterSk.toBytes()
      const skHex = Array.from(masterSkBytes).map(b => b.toString(16).padStart(2, '0')).join('')

      console.log("🚀 [CRYPTO FIX] ОТПРАВЛЯЕМ КАНOНИЧЕСКИЙ MASTER SK В ПИТОН:", skHex)
      return skHex
    } catch (e) {
      console.error("Критическая ошибка вычисления приватного ключа для роута:", e)
      return null
    }
  }, [decryptedPhrase])
  // 4. Подпись месседж-хэшей через готовый syntheticSkHex от бэкенда
  const signMessage = useCallback((syntheticSkHex: string, spendsArray: any[]): string | null => {
    if (!decryptedPhrase) {
      console.error("[ChiaCrypto] Ошибка подписи: мнемоника отсутствует в памяти")
      return null
    }
    return signTransactionSpends(syntheticSkHex, spendsArray)
  }, [decryptedPhrase])

  // 5. Колбэк успешной разблокировки экрана/входа
  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      const activeMnemonic = clearMnemonic
      const walletPublicKeyHex = runCryptoAudit(activeMnemonic)

      if (!walletPublicKeyHex) {
        throw new Error("Не удалось рассчитать публичный ключ кошелька")
      }

      const response = await fetch("/api/chia/address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wallet_pk_hex: walletPublicKeyHex }),
      })

      if (!response.ok) {
        throw new Error(`Сервер вернул статус ${response.status} при запросе адреса`)
      }

      const data = await response.json()

      if (data.status !== "success" || !data.address) {
        throw new Error(data.message || "Ошибка генерации адреса")
      }

      const realChiaAddress = data.address
      console.log(`%c [XCHA API SUCCESS] Реальный адрес получен: ${realChiaAddress}`, "color: #10B981; font-weight: bold;")

      if (typeof window !== 'undefined') {
        sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      }

      setWalletData(realChiaAddress, activeMnemonic)
      setScreenLocked(false)

    } catch (error: any) {
      console.error("Критическая ошибка авторизации кошелька:", error)
      alert(`Ошибка авторизации: ${error.message || error}`)
    }
  }, [setWalletData, setScreenLocked])

  // 6. Инициализация сессии и защита роутинга при монтировании
  useEffect(() => {
    const initAuth = async () => {
      if (typeof window === 'undefined') return

      const isAuth = localStorage.getItem("xcha_is_auth")
      const savedMnemonic = localStorage.getItem("xcha_mnemonic")

      if (isAuth !== "true" || !savedMnemonic) {
        window.location.href = "/"
        return
      }

      const sessionExpires = sessionStorage.getItem("xcha_session_expires")
      const now = Date.now()
      const isSessionValid = sessionExpires && now < parseInt(sessionExpires, 10)

      if (isSessionValid && walletAddress && decryptedPhrase) {
        setScreenLocked(false)
      } else {
        lockWallet()
      }

      setVerifying(false)
    }

    initAuth()
  }, [walletAddress, decryptedPhrase, lockWallet, setVerifying, setScreenLocked])

  // 7. Отслеживание бездействия пользователя (Auto-Lock Session)
  useEffect(() => {
    if (isVerifying || isScreenLocked) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      if (typeof window === 'undefined') return
      clearTimeout(timeoutId)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())

      timeoutId = setTimeout(() => {
        lockWallet()
      }, INACTIVITY_TIMEOUT)
    }

    const events = ["mousemove", "keydown", "touchstart", "click"]
    events.forEach(event => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      events.forEach(event => window.removeEventListener(event, resetTimer))
    }
  }, [isVerifying, isScreenLocked, lockWallet])

  return {
    walletAddress,
    decryptedPhrase,
    isVerifying,
    isScreenLocked,
    handleUnlockSuccess,
    lockWallet,
    logCryptoAudit,
    getUnhardenedPkHex,
    getUnhardenedSkHex,
    signMessage
  }
}
