'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, PlusCircle } from "lucide-react"
// @ts-ignore
import * as bip39 from "bip39"


import { CreateWalletForm } from "./_components/CreateWalletForm"
import { ImportWalletForm } from "./_components/ImportWalletForm"
import { PinCodeForm } from "./_components/PinCodeForm"
import { AuthBackground } from "./_components/AuthBackground"
import { AuthHeader } from "./_components/AuthHeader"

import { Card, CardContent } from "../../components/ui/card"
import { encryptMnemonic } from "../../lib/crypto"

export default function AuthPage() {
  const router = useRouter()
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
      const encryptedData = await encryptMnemonic(phraseToEncrypt, finalPin)
      localStorage.setItem("xcha_mnemonic", encryptedData)
      localStorage.setItem("xcha_is_auth", "true")
      sessionStorage.setItem("xcha_session_expires", (Date.now() + 5 * 60 * 1000).toString())
      
      router.push("/dashboard")
    } catch (err) {
      alert("Криптографическая ошибка создания сейфа")
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-white font-sans antialiased overflow-hidden flex flex-col justify-between">
      {/* Задний фон вынесен в компонент */}
      <AuthBackground />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 flex-1 flex flex-col justify-between py-10">
        <div className="w-full space-y-8">
          
          {/* Шапка вынесена в компонент */}
          <AuthHeader version="v0.2.0" />

          {!showPin ? (
            <>
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
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "phrase" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <KeyRound size={13} />
                  <span>Войти</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("create")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "create" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
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
            </>
          ) : (
            <PinCodeForm onSuccess={handlePinSuccess} />
          )}

        </div>

        <footer className="w-full text-center pt-8">
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">XCH Ecosystem • Secure Wallet Solution</p>
        </footer>
      </div>
    </div>
  )
}
