'use client'

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, PlusCircle } from "lucide-react"
// @ts-ignore
import * as bip39 from "bip39"
import chiaBls from 'chia-bls'

const { PrivateKey, AugSchemeMPL } = chiaBls
const CHIA_PORT = 12381
const CHIA_COIN = 8444

// Импортируем Zustand-стор
import { useWalletStore } from "@/store/useWalletStore"

// Компоненты форм и шаблона
import { CreateWalletForm } from "./_components/CreateWalletForm"
import { ImportWalletForm } from "./_components/ImportWalletForm"
import { PinCodeForm } from "./_components/PinCodeForm"
import { AuthBackground } from "./_components/AuthBackground"
import { WalletLayout } from "@/components/WalletLayout"

import { encryptMnemonic, getContractAddress } from "@/lib/crypto"
import { Card, CardContent } from "@/components/ui/card"

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут для сессии

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

export default function AuthPage() {
  const router = useRouter()
  const { setWalletData } = useWalletStore()

  const [showPin, setShowPin] = useState(false)
  const [activeTab, setActiveTab] = useState<"phrase" | "create">("phrase")

  const [seedPhrase, setSeedPhrase] = useState("")
  const [isAgreed, setIsAgreed] = useState(false)
  const [generatedPhrase, setGeneratedPhrase] = useState("")
  const [phraseToEncrypt, setPhraseToEncrypt] = useState("")

  const generateNewWalletWords = () => {
    try {
      const mnemonic = bip39.generateMnemonic(256)
      setGeneratedPhrase(mnemonic)
    } catch (e) {
      setGeneratedPhrase("Ошибка инициализации bip39.")
    }
  }

  useEffect(() => {
    generateNewWalletWords()
  }, [])

  // =========================================================================
  // ПОЛНЫЙ КРИПТОГРАФИЧЕСКИЙ АУДИТ ДЛЯ ЭКРАНА ВХОДА/РЕГИСТРАЦИИ
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

      // Вычисляем адрес локально для логов аудита
      const localAddress = getContractAddress(clearMnemonic)

      console.log("%c 🔑 [XCHA REGISTRATION CRYPTO AUDIT] ", "background: #B82EFF; color: white; font-weight: bold; padding: 4px; border-radius: 4px;")
      console.log(`1. Mnemonic: "${clearMnemonic}"`)
      console.log(`2. Master SK Hex: ${master_sk_hex}`)
      console.log(`3. Master PK Hex: ${master_pk_hex}`)
      console.log(`4. Fingerprint: ${fingerprint}`)
      console.log(`5. Farmer PK Hex: ${farmer_pk_hex}`)
      console.log(`6. Pool PK Hex: ${pool_pk_hex}`)
      console.log(`7. Wallet SK Hex (Hardened): ${wallet_sk_hex}`)
      console.log(`8. Смарт-контракт (Локально): ${localAddress}`)
      console.log(`🚀 ИТОГОВЫЙ ПАБЛИК ДЛЯ ПИТОНА (Unhardened PK Hex): %c${unhardened_wallet_pk_hex}`, "color: #10B981; font-weight: bold; font-size: 11px;")
      console.log("%c ---------------------------------------------------- ", "color: #52525b;")

      return localAddress
    } catch (e) {
      console.error("Ошибка при расчете ключей аудите регистрации:", e)
      return null
    }
  }, [])

  const handleWalletSubmit = (phraseToSave: string) => {
    const cleanPhrase = phraseToSave.trim()
    if (!cleanPhrase || cleanPhrase.startsWith("Ошибка")) return

    setPhraseToEncrypt(cleanPhrase)
    setShowPin(true)
  }

  const handlePinSuccess = async (finalPin: string) => {
    try {
      // 1. Шифруем и сохраняем в localStorage для долгосрочного хранения (БЕЗОПАСНО)
      const encryptedData = await encryptMnemonic(phraseToEncrypt, finalPin)
      localStorage.setItem("xcha_mnemonic", encryptedData)
      localStorage.setItem("xcha_is_auth", "true")

      // 2. Устанавливаем время экспирации сессии (5 минут)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())

      // 3. Запускаем аудит — рассчитываем адрес локально без сетевых запросов
      const derivedAddress = logCryptoAudit(phraseToEncrypt)

      if (!derivedAddress) {
        throw new Error("Не удалось рассчитать адрес смарт-контракта")
      }

      console.log(`%c [XCHA AUTH SUCCESS] Кошелек успешно создан. Локальный адрес: ${derivedAddress}`, "color: #10B981; font-weight: bold;")

      // 4. Записываем в Zustand локально вычисленный адрес кошелька
      setWalletData(derivedAddress, "")

      // 5. Жесткое обнуление локальных стейтов
      setPhraseToEncrypt("")
      setSeedPhrase("")
      setGeneratedPhrase("")

      // 6. Переходим на дашборд
      router.push("/dashboard")
    } catch (err: any) {
      console.error("Криптографическая ошибка создания сейфа:", err)
      alert(`Ошибка при инициализации кошелька: ${err.message || err}`)
    }
  }
  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white font-sans antialiased overflow-hidden flex flex-col justify-between">
      <AuthBackground />

      <WalletLayout variant="auth" version="v0.2.0">
        {!showPin ? (
          <div className="space-y-6">
            <section className="space-y-2.5">
              <h1 className="text-3xl font-black tracking-tight text-white leading-tight">
                Вход в <span className="bg-gradient-to-r from-[#FF2E93] to-[#B82EFF] bg-clip-text text-transparent">XCHA Wallet</span>
              </h1>
              <p className="text-xs font-semibold text-zinc-400 leading-relaxed">
                Управляй своим балансом Chia (XCH). Выбери: войти по существующим ключам или создать новый кошелек локально.
              </p>
            </section>

            <div className="grid grid-cols-2 bg-zinc-900/60 p-1 border border-zinc-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab("phrase")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "phrase" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
                  }`}
              >
                <KeyRound size={13} />
                <span>Войти</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "create" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
                  }`}
              >
                <PlusCircle size={13} />
                <span>Создать кошелек</span>
              </button>
            </div>

            <Card className="bg-zinc-900/40 border border-zinc-900 shadow-2xl backdrop-blur-xl rounded-[28px] overflow-hidden">
              <CardContent className="p-5">
                {activeTab === "phrase" ? (
                  <ImportWalletForm
                    seedPhrase={seedPhrase}
                    setSeedPhrase={setSeedPhrase}
                    onSubmit={handleWalletSubmit}
                  />
                ) : (
                  <CreateWalletForm
                    generatedPhrase={generatedPhrase}
                    isAgreed={isAgreed}
                    setIsAgreed={setIsAgreed}
                    onRegenerate={generateNewWalletWords}
                    onSubmit={() => handleWalletSubmit(generatedPhrase)}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <PinCodeForm onSuccess={handlePinSuccess} />
        )}
      </WalletLayout>
    </div>
  )
}
