'use client'

import React, { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { KeyRound, PlusCircle } from "lucide-react"

import { GeneratePhraseForm } from "./_components/GeneratePhraseForm"
import { ImportPhraseForm } from "./_components/ImportPhraseForm"
import { CreateWalletForm } from "./CreateWalletForm"
import { AuthBackground } from "./_components/AuthBackground"
import { WalletLayout } from "@/components/WalletLayout"
import { Card, CardContent } from "@/components/ui/card"

export default function AuthPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentTab = searchParams.get("tab") === "create" ? "create" : "phrase"

  const [showPin, setShowPin] = useState(false)
  const [phraseToEncrypt, setPhraseToEncrypt] = useState("")

  const handleTabChange = (tabName: "phrase" | "create") => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tabName)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handlePhraseSubmit = (phraseToSave: string) => {
    const cleanPhrase = phraseToSave.trim()
    if (!cleanPhrase) return

    setPhraseToEncrypt(cleanPhrase)
    setShowPin(true)
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

            {/* Переключатель вкладок */}
            <div className="grid grid-cols-2 bg-zinc-900/60 p-1 border border-zinc-800 rounded-2xl">
              <button
                type="button"
                onClick={() => handleTabChange("phrase")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === "phrase" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
                  }`}
              >
                <KeyRound size={13} />
                <span>Войти</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("create")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentTab === "create" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
                  }`}
              >
                <PlusCircle size={13} />
                <span>Создать кошелек</span>
              </button>
            </div>

            {/* Карточка с динамической формой фразы */}
            <Card className="bg-zinc-900/40 border border-zinc-900 shadow-2xl backdrop-blur-xl rounded-[28px] overflow-hidden">
              <CardContent className="p-5">
                {currentTab === "phrase" ? (
                  <ImportPhraseForm onSubmit={handlePhraseSubmit} />
                ) : (
                  <GeneratePhraseForm onSubmit={handlePhraseSubmit} />
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Форма шифрования пин-кодом */
          <CreateWalletForm
            phraseToEncrypt={phraseToEncrypt}
            onAuthComplete={() => {
              setPhraseToEncrypt("")
              setShowPin(false)
            }}
          />
        )}
      </WalletLayout>
    </div>
  )
}
