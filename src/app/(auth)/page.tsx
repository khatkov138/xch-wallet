'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, PlusCircle } from "lucide-react"
// @ts-ignore
import * as bip39 from "bip39"

// Импортируем Zustand-стор и метод деривации адреса Chia
import { useWalletStore } from "@/store/useWalletStore"
import { generateChiaAddressFromMnemonic } from "@/lib/chia-crypto"

// Компоненты форм и шаблона
import { CreateWalletForm } from "./_components/CreateWalletForm"
import { ImportWalletForm } from "./_components/ImportWalletForm"
import { PinCodeForm } from "./_components/PinCodeForm"
import { AuthBackground } from "./_components/AuthBackground"
import { WalletLayout } from "@/components/WalletLayout"

import { encryptMnemonic } from "@/lib/crypto"
import { Card, CardContent } from "@/components/ui/card"

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут для сессии

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

  const handleWalletSubmit = (phraseToSave: string) => {
    const cleanPhrase = phraseToSave.trim()
    if (!cleanPhrase || cleanPhrase.startsWith("Ошибка")) return

    setPhraseToEncrypt(cleanPhrase)
    setShowPin(true)
  }

  const handlePinSuccess = async (finalPin: string) => {
    try {
      // 1. Шифруем и сохраняем в localStorage для долгосрочного хранения
      const encryptedData = await encryptMnemonic(phraseToEncrypt, finalPin)
      localStorage.setItem("xcha_mnemonic", encryptedData)
      localStorage.setItem("xcha_is_auth", "true")

      // 2. Устанавливаем время экспирации сессии (5 минут)
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString())

      // === ДОБАВЛЕНО: Сохраняем чистую фразу в сессию вкладки для защиты от F5 ===
      sessionStorage.setItem("xcha_clear_mnemonic", phraseToEncrypt)

      // 3. Генерируем адрес кошелька на клиенте из чистой мнемоники
      const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true"
      const derivedAddress = await generateChiaAddressFromMnemonic(phraseToEncrypt, isTestnet)

      // 4. Записываем данные в Zustand
      setWalletData(derivedAddress, phraseToEncrypt)

      // 5. Переходим на дашборд
      router.push("/dashboard")
    } catch (err) {
      console.error("Криптографическая ошибка создания сейфа:", err)
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
