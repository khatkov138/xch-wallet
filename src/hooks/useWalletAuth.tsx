'use client'

import { useEffect, useCallback } from "react"
import { useWalletStore } from "@/store/useWalletStore"
import bip39 from 'bip39'
import chiaBls from 'chia-bls'
import { sha256 } from '@noble/hashes/sha256' // Безопасный хэшер для Next.js

const { PrivateKey, AugSchemeMPL, JacobianPoint } = chiaBls

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут сессии
const CHIA_PORT = 12381
const CHIA_COIN = 8444

// Криптографические константы Chia для синтетического ключа
const GROUP_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001")
const DEFAULT_HIDDEN_PUZZLE_HASH = "711d6c4e32c92e53179b1994a5288a2da05bde7851007a413da9f27dda2c8ceb"

// Хелперы для работы с байтами
const hexToBytes = (hex: string): Uint8Array => {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16)
  }
  return bytes
}

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

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
  // Вытаскиваем все методы и стейты прямо из Zustand
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

  // =========================================================================
  // ИСПРАВЛЕННЫЙ МЕТОД ПОДПИСИ И ЛОКАЛЬНОЙ ВЕРИФИКАЦИИ (ЭТАП 2 И 3)
  // =========================================================================
      // =========================================================================
  // ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ МЕТОД ПОДПИСИ (КАНОН CHIA CLVM SYNTHETIC KEY)
  // =========================================================================
  const signMessage = useCallback((messageHashHex: string): string | null => {
    try {
      if (!decryptedPhrase) {
        console.error("[ChiaCrypto] Ошибка подписи: мнемоника отсутствует в памяти")
        return null
      }

      console.log("%c 🔐 [XCHA FRONTEND - ЭТАП 2: ГЕНЕРАЦИЯ ПОДПИСИ] ", "background: #10B981; color: white; font-weight: bold; padding: 4px; border-radius: 4px;")

      // 1. Из сида восстанавливаем мастер-ключ
      const seed = bip39.mnemonicToSeedSync(decryptedPhrase.trim())
      const masterSk = PrivateKey.fromSeed(seed)

      // 2. Деривируем Unhardened Wallet Private Key по пути (2, 0)
      const unhardenedWalletSk = derivePathUnhardened(masterSk, [CHIA_PORT, CHIA_COIN, 2, 0])
      const unhardenedWalletPk = unhardenedWalletSk.getG1()

      // 3. ИСПРАВЛЕНО: Канонический расчет CLVM Tree Hash для твика (Synthetic Key)
      const pkBytes = unhardenedWalletPk.toBytes() // 48 байт
      const hiddenPuzzleBytes = hexToBytes(DEFAULT_HIDDEN_PUZZLE_HASH) // 32 байта

      // Вычисляем хэш левого листа (атома публичного ключа): sha256(0x01 + pkBytes)
      const leftAtom = new Uint8Array(1 + pkBytes.length)
      leftAtom[0] = 0x01 // Префикс атома в CLVM
      leftAtom.set(pkBytes, 1)
      const leftHash = sha256(leftAtom)

      // Вычисляем хэш пары (дерево условий): sha256(0x02 + leftHash + hiddenPuzzleBytes)
      const pairBuffer = new Uint8Array(1 + leftHash.length + hiddenPuzzleBytes.length)
      pairBuffer[0] = 0x02 // Префикс пары в CLVM
      pairBuffer.set(leftHash, 1)
      pairBuffer.set(hiddenPuzzleBytes, 1 + leftHash.length)

      // Итоговый хэш твика
      const tweakHash = sha256(pairBuffer)
      const tweakBigInt = BigInt("0x" + bytesToHex(tweakHash))

      // 4. Длинная арифметика BigInt для синтетического приватного ключа по модулю кривой
      const walletSkBigInt = BigInt("0x" + unhardenedWalletSk.toHex())
      const syntheticSkBigInt = (walletSkBigInt + tweakBigInt) % GROUP_ORDER
      
      const syntheticSkHex = syntheticSkBigInt.toString(16).padStart(64, '0')
      const syntheticSk = PrivateKey.fromHex(syntheticSkHex)

      // 5. Подписание message_hash_hex (генерация подписи AugSchemeMPL)
      const msgBytes = hexToBytes(messageHashHex)
      const signature = AugSchemeMPL.sign(syntheticSk, msgBytes)
      const signatureHex = signature.toHex()

      console.log(`1. Успешно сгенерирована подпись: ${signatureHex}`)
      console.log("%c ---------------------------------------------------------------- ", "color: #52525b;")
      
      return signatureHex

    } catch (e) {
      console.error("Критическая ошибка при подписи хэша на фронтенде:", e)
      return null
    }
  }, [decryptedPhrase])


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

      // Передаем адрес И мнемонику в Zustand. Стор сам закинет их в sessionStorage
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

      // ИСПРАВЛЕНИЕ ДЛЯ F5
      if (isSessionValid && walletAddress && decryptedPhrase) {
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
    decryptedPhrase,
    isVerifying,
    isScreenLocked,
    handleUnlockSuccess,
    lockWallet,
    signMessage
  }
}