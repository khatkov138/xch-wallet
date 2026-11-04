'use client'

import React, { useState, useCallback } from "react"
import { KeyRound, PlusCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ImportPhraseForm } from "./_components/auth/import-wallet/ImportPhraseForm"
import { GeneratePhraseForm } from "./_components/auth/GeneratePhraseForm"
import { CreateWalletForm } from "./_components/auth/CreateWalletForm"
import { useWalletContext } from "../../WalletContext"

function AuthTabsContainer({ 
  currentTab, 
  onTabChange, 
  onSubmit 
}: { 
  currentTab: "phrase" | "create"
  onTabChange: (tabName: "phrase" | "create") => void
  onSubmit: (phrase: string) => void 
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 bg-zinc-900/60 p-1 border border-zinc-800 rounded-2xl">
        <button
          type="button"
          onClick={() => onTabChange("phrase")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            currentTab === "phrase" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
          }`}
        >
          <KeyRound size={13} />
          <span>Войти</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("create")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            currentTab === "create" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
          }`}
        >
          <PlusCircle size={13} />
          <span>Создать кошелек</span>
        </button>
      </div>

      <Card className="bg-zinc-900/40 border border-zinc-900 shadow-2xl backdrop-blur-xl rounded-[28px] overflow-hidden">
        <CardContent className="p-5">
          {currentTab === "phrase" ? (
            <ImportPhraseForm onSubmit={onSubmit} />
          ) : (
            <GeneratePhraseForm onSubmit={onSubmit} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthClient() {
  const { network } = useWalletContext()
  const [currentTab, setCurrentTab] = useState<"phrase" | "create">("phrase")
  const [showPin, setShowPin] = useState(false)
  const [phraseToEncrypt, setPhraseToEncrypt] = useState("")

  const handlePhraseSubmit = useCallback((phraseToSave: string) => {
    const cleanPhrase = phraseToSave.trim()
    if (!cleanPhrase) return

    setPhraseToEncrypt(cleanPhrase)
    setShowPin(true)
  }, [])

  return (
    <div className="w-full space-y-6 pt-4 animate-in fade-in duration-300">
      {!showPin ? (
        <div className="space-y-6">
          <section className="space-y-2.5">
            <h1 className="text-3xl font-black tracking-tight text-white leading-tight">
              Вход в <span className="bg-gradient-to-r from-[#FF2E93] to-[#B82EFF] bg-clip-text text-transparent">XCHIA Wallet</span>
            </h1>
            <p className="text-xs font-semibold text-zinc-400 leading-relaxed">
              Управляй своим балансом Chia (XCH). Текущая сеть: <span className="text-[#FF2E93] font-bold uppercase">{network}</span>. Выбери вход по ключам или генерацию новой локальной сессии.
            </p>
          </section>

          <AuthTabsContainer 
            currentTab={currentTab} 
            onTabChange={setCurrentTab} 
            onSubmit={handlePhraseSubmit} 
          />
        </div>
      ) : (
        <CreateWalletForm phraseToEncrypt={phraseToEncrypt} />
      )}
    </div>
  )
}
