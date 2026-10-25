'use client'

import { useEffect, useCallback } from "react"
import { useWalletStore } from "@/store/useWalletStore"
import { runCryptoAudit } from "@/lib/crypto"

const INACTIVITY_TIMEOUT = 5 * 60 * 1000

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

  const logCryptoAudit = useCallback((clearMnemonic: string) => {
    return runCryptoAudit(clearMnemonic)
  }, [])

  const getUnhardenedPkHex = useCallback((): string | null => {
    if (!decryptedPhrase) return null
    const auditJson = runCryptoAudit(decryptedPhrase)
    if (!auditJson) return null
    try {
      return JSON.parse(auditJson).unhardened_wallet_pk_hex || null
    } catch {
      return null
    }
  }, [decryptedPhrase])

  // ИСПРАВЛЕНО: Безопасно забираем уже вычисленный SK напрямую из JSON аудита без падений
  const getUnhardenedSkHex = useCallback((): string | null => {
    if (!decryptedPhrase) return null
    const auditJson = runCryptoAudit(decryptedPhrase)
    if (!auditJson) return null
    try {
      return JSON.parse(auditJson).wallet_sk_hardened_hex || null
    } catch {
      return null
    }
  }, [decryptedPhrase])

  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      const auditJson = runCryptoAudit(clearMnemonic)
      if (!auditJson) throw new Error("Критический сбой аудита ключей")

      const auditData = JSON.parse(auditJson)

      console.log(
        `%c🔑 [XCHA CRYPTO AUDIT RESULT]\n` +
        `----------------------------------------\n` +
        `📝 Мнемоника:          "${auditData.mnemonic}"\n` +
        `🔑 Master SK Hex:       ${auditData.master_sk_hex}\n` +
        `🔑 Master PK Hex:       ${auditData.master_pk_hex}\n` +
        `🆔 Fingerprint:         ${auditData.fingerprint}\n` +
        `🚜 Farmer PK Hex:       ${auditData.farmer_pk_hex}\n` +
        `🌊 Pool PK Hex:         ${auditData.pool_pk_hex}\n` +
        `🔒 Canonical Wallet SK: ${auditData.wallet_sk_hardened_hex} (Используем для Шага 3)\n` +
        `🚀 Canonical Wallet PK: ${auditData.unhardened_wallet_pk_hex} (Отправляем на бэкенд)\n` +
        `----------------------------------------`,
        "color: #8B5CF6; font-weight: bold; font-family: monospace;"
      )

      const walletPublicKeyHex = auditData.unhardened_wallet_pk_hex
      if (!walletPublicKeyHex) throw new Error("Unhardened PK отсутствует в результатах")

      console.log(
        `%c📡 [API REQUEST] -> POST /api/chia/address\n` +
        `📦 Payload: { wallet_pk_hex: "${walletPublicKeyHex}" }`,
        "color: #3B82F6; font-family: monospace;"
      )

      const response = await fetch("/api/chia/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_pk_hex: walletPublicKeyHex }),
      })

      if (!response.ok) throw new Error(`HTTP Error ${response.status}`)
      const data = await response.json()

      console.log(
        `%c📥 [API RESPONSE] <- Status: ${response.status}\n` +
        `📄 Data: ${JSON.stringify(data, null, 2)}`,
        data.status === "success" ? "color: #10B981; font-family: monospace;" : "color: #EF4444; font-family: monospace;"
      )

      if (data.status !== "success" || !data.address) throw new Error(data.message || "Bad response")

      if (typeof window !== 'undefined') {
        sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      }

      setWalletData(data.address, clearMnemonic.trim())
      setScreenLocked(false)

    } catch (error: any) {
      console.error("❌ Ошибка авторизации:", error)
      alert(`Ошибка авторизации: ${error.message || error}`)
    }
  }, [setWalletData, setScreenLocked])

  useEffect(() => {
    const initAuth = async () => {
      if (typeof window === 'undefined') return
      if (localStorage.getItem("xcha_is_auth") !== "true" || !localStorage.getItem("xcha_mnemonic")) {
        window.location.href = "/"
        return
      }
      const sessionExpires = sessionStorage.getItem("xcha_session_expires")
      if (sessionExpires && Date.now() < parseInt(sessionExpires, 10) && walletAddress && decryptedPhrase) {
        setScreenLocked(false)
      } else {
        lockWallet()
      }
      setVerifying(false)
    }
    initAuth()
  }, [walletAddress, decryptedPhrase, lockWallet, setVerifying, setScreenLocked])

  useEffect(() => {
    if (isVerifying || isScreenLocked) return
    let timeoutId: NodeJS.Timeout
    const resetTimer = () => {
      if (typeof window === 'undefined') return
      clearTimeout(timeoutId)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      timeoutId = setTimeout(() => lockWallet(), INACTIVITY_TIMEOUT)
    }
    const events = ["mousemove", "keydown", "touchstart", "click"]
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      clearTimeout(timeoutId)
      events.forEach(e => window.removeEventListener(e, resetTimer))
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
    getUnhardenedSkHex
  }
}
