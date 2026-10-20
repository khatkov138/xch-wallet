'use client'

import { useEffect, useCallback, useState } from "react"
import { useWalletStore } from "@/store/useWalletStore"
import { generateChiaAddressFromMnemonic, getChiaKeyDebugInfo } from "@/lib/chia-crypto"

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут сессии

// Локальное in-memory хранилище сессии вкладки для защиты от атак XSS
let IN_MEMORY_SEED_PHRASE = ""

export function useWalletAuth() {
  const {
    walletAddress,
    isScreenLocked,
    isVerifying,
    setWalletData,
    lockWallet,
    setVerifying,
    setScreenLocked
  } = useWalletStore()

  // Локальный стейт для реактивного проброса фразы в BackupCard
  const [decryptedPhrase, setDecryptedPhrase] = useState("")

  // =========================================================================
  // ТВОИ ЛОГИ ТУТ — АВТОМАТИЧЕСКИЙ КРИПТОГРАФИЧЕСКИЙ АУДИТ
  // =========================================================================
  const logCryptoAudit = useCallback(async (clearMnemonic: string) => {
    try {
      const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
      const debug = await getChiaKeyDebugInfo(clearMnemonic, isTestnet)

      console.log("%c 🔑 [XCHA WALLET AUTOMATED AUDIT] ", "background: #FF2E93; color: white; font-weight: bold; padding: 4px; border-radius: 4px;")
      console.log(`• Твоя фраза: "${clearMnemonic}"`)
      console.log(`• Master Fingerprint (из ноды ждем 403921831): %c${debug.masterFingerprint}`, "color: #FF2E93; font-weight: bold;")
      console.log(`• Master Public Key (Hex): ${debug.masterPublicKey}`)
      console.log(`👉 ВАРИАНТ А (Unhardened): ${debug.addrUnhardened}`)
      console.log(`👉 ВАРИАНТ Г (CLI Sk Path): ${debug.addrFirstWalletSk}`)
      console.log("%c ---------------------------------------------------- ", "color: #52525b;")
    } catch (e) {
      console.error("Ошибка дебаг-логирования:", e)
    }
  }, [])

  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"

      // 1. Рассчитываем динамический адрес кошелька на клиенте
      const derivedAddress = await generateChiaAddressFromMnemonic(clearMnemonic, isTestnet)

      // 2. Стреляем расширенным аудитом промежуточных нод прямо в консоль разработчика
      await logCryptoAudit(clearMnemonic)

      // 3. Кэшируем мнемонику исключительно в изолированную область памяти вкладки
      IN_MEMORY_SEED_PHRASE = clearMnemonic
      setDecryptedPhrase(clearMnemonic)

      // 4. Записываем метку жизни сессии и обновляем Zustand (только публичный адрес!)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      setWalletData(derivedAddress)
      setScreenLocked(false)
    } catch (error) {
      console.error("Ошибка при обработке входа:", error)
    }
  }, [setWalletData, setScreenLocked, logCryptoAudit])

  // Кастомное переопределение лока для жесткого уничтожения in-memory кэша
  const handleLockWallet = useCallback(() => {
    IN_MEMORY_SEED_PHRASE = ""
    setDecryptedPhrase("")
    lockWallet()
  }, [lockWallet])

  useEffect(() => {
    const initAuth = async () => {
      const isAuth = localStorage.getItem("xcha_is_auth")
      const savedMnemonic = localStorage.getItem("xcha_mnemonic")

      if (isAuth !== "true" || !savedMnemonic) {
        window.location.href = "/"
        return
      }

      const sessionExpires = sessionStorage.getItem("xcha_session_expires")
      const now = Date.now()
      const isSessionValid = sessionExpires && now < parseInt(sessionExpires, 10)

      if (isSessionValid && walletAddress) {
        setScreenLocked(false)
        if (IN_MEMORY_SEED_PHRASE) setDecryptedPhrase(IN_MEMORY_SEED_PHRASE)
      } else {
        IN_MEMORY_SEED_PHRASE = ""
        setDecryptedPhrase("")
        lockWallet()
      }

      setVerifying(false)
    }

    initAuth()
  }, [walletAddress, lockWallet, setVerifying, setScreenLocked])

  useEffect(() => {
    if (isVerifying || isScreenLocked) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      clearTimeout(timeoutId)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      timeoutId = setTimeout(() => {
        IN_MEMORY_SEED_PHRASE = ""
        setDecryptedPhrase("")
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
    decryptedPhrase, // Возвращаем фразу на дашборд из ОЗУ вкладки
    isVerifying,
    isScreenLocked,
    handleUnlockSuccess,
    lockWallet: handleLockWallet
  }
}
