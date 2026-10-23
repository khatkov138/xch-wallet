'use client'

import { useEffect, useCallback } from "react"
import { useWalletStore } from "@/store/useWalletStore"
import bip39 from 'bip39'
import chiaBls from 'chia-bls'

const { PrivateKey, AugSchemeMPL } = chiaBls

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут сессии
const CHIA_PORT = 12381
const CHIA_COIN = 8444

function derivePath(masterSk: any, path: number[]) {
  let currentSk = masterSk
  for (const index of path) {
    currentSk = AugSchemeMPL.deriveChildSk(currentSk, index)
  }
  return currentSk
}

function derivePathUnhardened(masterSk: any, path: number[]) {
  let currentSk = masterSk
  for (const index of path) {
    currentSk = AugSchemeMPL.deriveChildSkUnhardened(currentSk, index)
  }
  return currentSk
}

export function useWalletAuth() {
  // Вытаскиваем все методы и стейты прямо из Zustand (включая decryptedPhrase)
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

  // =========================================================================
  // ТВОЙ ОРИГИНАЛЬНЫЙ КРИПТОГРАФИЧЕСКИЙ АУДИТ ДЛЯ КОНСОЛИ
  // =========================================================================
  const logCryptoAudit = useCallback((clearMnemonic: string) => {
    try {
      const seed = bip39.mnemonicToSeedSync(clearMnemonic)
      const master_sk = PrivateKey.fromSeed(seed)
      const master_sk_hex = master_sk.toHex()

      const master_pk = master_sk.getG1()
      const master_pk_hex = master_pk.toHex()
      const fingerprint = master_pk.getFingerprint()

      const farmer_sk = derivePath(master_sk, [CHIA_PORT, CHIA_COIN, 0, 0])
      const farmer_pk_hex = farmer_sk.getG1().toHex()

      const pool_sk = derivePath(master_sk, [CHIA_PORT, CHIA_COIN, 1, 0])
      const pool_pk_hex = pool_sk.getG1().toHex()

      const wallet_sk = derivePath(master_sk, [CHIA_PORT, CHIA_COIN, 2, 0])
      const wallet_sk_hex = wallet_sk.toHex()

      const unhardened_wallet_sk = derivePathUnhardened(master_sk, [CHIA_PORT, CHIA_COIN, 2, 0])
      const unhardened_wallet_pk = unhardened_wallet_sk.getG1()
      const unhardened_wallet_pk_hex = Buffer.from(unhardened_wallet_pk.toBytes()).toString('hex')

      console.log("%c 🔑 [XCHA FRONTEND CRYPTO AUDIT] ", "background: #8B5CF6; color: white; font-weight: bold; padding: 4px; border-radius: 4px;")
      console.log(`1. Mnemonic: "${clearMnemonic}"`)
      console.log(`2. Master SK Hex: ${master_sk_hex}`)
      console.log(`3. Master PK Hex: ${master_pk_hex}`)
      console.log(`4. Fingerprint: ${fingerprint}`)
      console.log(`5. Farmer PK Hex: ${farmer_pk_hex}`)
      console.log(`6. Pool PK Hex: ${pool_pk_hex}`)
      console.log(`7. Wallet SK Hex (Hardened): ${wallet_sk_hex}`)
      console.log(`🚀 ИТОГОВЫЙ ПАБЛИК ДЛЯ ПИТОНА (Unhardened PK Hex): %c${unhardened_wallet_pk_hex}`, "color: #10B981; font-weight: bold; font-size: 11px;")
      console.log("%c ---------------------------------------------------- ", "color: #52525b;")

      return unhardened_wallet_pk_hex
    } catch (e) {
      console.error("Ошибка при расчете ключей на фронтенде:", e)
      return null
    }
  }, [])

  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      const activeMnemonic = clearMnemonic
      const walletPublicKeyHex = logCryptoAudit(activeMnemonic)

      if (!walletPublicKeyHex) {
        throw new Error("Не удалось рассчитать публичный ключ кошелька")
      }

      // Отправляем публичный ключ на бэкенд Full Node
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

      // Записываем таймстамп окончания сессии активности
      if (typeof window !== 'undefined') {
        sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      }

      // ИСПРАВЛЕНИЕ: Передаем адрес И мнемонику в Zustand. Стор сам закинет их в sessionStorage
      setWalletData(realChiaAddress, activeMnemonic)
      setScreenLocked(false)

    } catch (error: any) {
      console.error("Критическая ошибка авторизации кошелька:", error)
      alert(`Ошибка авторизации: ${error.message || error}`)
    }
  }, [setWalletData, setScreenLocked, logCryptoAudit])

  // Жизненный цикл сессии и проверка авторизации при F5
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

      // ИСПРАВЛЕНИЕ ДЛЯ F5: Благодаря Zustand Persist, если сессия валидна и в сторе есть адрес — 
      // страница обновляется без разлогина, а мнемоника восстанавливается сама!
      if (isSessionValid && walletAddress && decryptedPhrase) {
        setScreenLocked(false)
      } else {
        // Если время сессии истекло, жестко стираем стейты через Zustand экшен
        lockWallet()
      }

      setVerifying(false)
    }

    initAuth()
  }, [walletAddress, decryptedPhrase, lockWallet, setVerifying, setScreenLocked])

  // Эффект автоматического сброса сессии по неактивности пользователя
  useEffect(() => {
    if (isVerifying || isScreenLocked) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      if (typeof window === 'undefined') return
      clearTimeout(timeoutId)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())
      timeoutId = setTimeout(() => {
        lockWallet() // Автоматически затирает стор Zustand при простое
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
    decryptedPhrase, // Наша BackupCard подхватит чистую строку отсюда
    isVerifying,
    isScreenLocked,
    handleUnlockSuccess,
    lockWallet
  }
}
