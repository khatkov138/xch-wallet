'use client'

import { useEffect, useCallback } from "react"
import { useWalletStore } from "@/store/useWalletStore"
import { generateChiaAddressFromMnemonic, getChiaKeyDebugInfo } from "@/lib/chia-crypto"

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут сессии

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

  // Полное отладочное логирование
  const logCryptoAudit = useCallback(async (clearMnemonic: string) => {
    try {
      const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
      const debug = await getChiaKeyDebugInfo(clearMnemonic, isTestnet)
      
      console.log("%c 🔑 [XCHA WALLET AUTOMATED AUDIT] ", "background: #FF2E93; color: white; font-weight: bold; padding: 4px; border-radius: 4px;")
      console.log(`• Твоя фраза: "${clearMnemonic}"`)
      console.log(`• Master Fingerprint (из ноды ждем 403921831): %c${debug.masterFingerprint}`, "color: #FF2E93; font-weight: bold;")
      console.log(`• Master Public Key (Hex): ${debug.masterPublicKey}`)
      console.log(`👉 ВАРИАНТ А (Unhardened): ${debug.addrUnhardened}`)
      console.log(`👉 ВАРИАНТ Б (Mixed Observer): ${debug.addrMixedObserver}`)
      console.log(`👉 ВАРИАНТ В (Full Hardened): ${debug.addrFullHardened}`)
      console.log(`👉 ВАРИАНТ Г (CLI Sk Path): ${debug.addrFirstWalletSk}`)
      console.log("%c ---------------------------------------------------- ", "color: #52525b;")
    } catch (e) {
      console.error("Ошибка дебаг-логирования:", e)
    }
  }, [])

  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      sessionStorage.setItem("xcha_clear_mnemonic", clearMnemonic)

      const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"

      // Печатаем расширенные логи
      await logCryptoAudit(clearMnemonic)

      const derivedAddress = await generateChiaAddressFromMnemonic(clearMnemonic, isTestnet)
      setWalletData(derivedAddress, clearMnemonic)
      setScreenLocked(false)
    } catch (error) {
      console.error("Ошибка при обработке входа:", error)
    }
  }, [setWalletData, setScreenLocked, logCryptoAudit])

  useEffect(() => {
    const initAuth = async () => {
      const isAuth = localStorage.getItem("xcha_is_auth")
      const savedMnemonic = localStorage.getItem("xcha_mnemonic")

      if (isAuth !== "true" || !savedMnemonic) {
        window.location.href = "/"
        return
      }

      const sessionExpires = sessionStorage.getItem("xcha_session_expires")
      const clearMnemonic = sessionStorage.getItem("xcha_clear_mnemonic")
      const now = Date.now()

      const isSessionValid = sessionExpires && now < parseInt(sessionExpires, 10)

      if (isSessionValid && walletAddress) {
        setScreenLocked(false)
        if (clearMnemonic) await logCryptoAudit(clearMnemonic)
      } else if (isSessionValid && clearMnemonic) {
        try {
          const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
          
          await logCryptoAudit(clearMnemonic)

          const derivedAddress = await generateChiaAddressFromMnemonic(clearMnemonic, isTestnet)
          setWalletData(derivedAddress, clearMnemonic)
          setScreenLocked(false)
        } catch (e) {
          lockWallet()
        }
      } else {
        lockWallet()
        sessionStorage.removeItem("xcha_clear_mnemonic")
      }

      setVerifying(false)
    }

    initAuth()
  }, [walletAddress, lockWallet, setVerifying, setScreenLocked, setWalletData, logCryptoAudit])

  useEffect(() => {
    if (isVerifying || isScreenLocked) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      clearTimeout(timeoutId)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      timeoutId = setTimeout(() => {
        lockWallet()
        sessionStorage.removeItem("xcha_clear_mnemonic")
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
    lockWallet
  }
}
