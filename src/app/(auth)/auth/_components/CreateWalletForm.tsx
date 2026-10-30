'use client'

import React, { useState } from "react"
import { useRouter } from "next/navigation"

import { PinCodeLayout } from "@/components/PinCodeLayout"
import { useWalletAuth } from "@/hooks/useWalletAuth" 
import { useSecureStorage } from "@/store/useWalletStore" 
import { encryptMnemonic } from "@/utils/crypto" 

interface EncryptPhraseFormProps {
  phraseToEncrypt: string
  onAuthComplete: () => void
}

export function CreateWalletForm({ phraseToEncrypt, onAuthComplete }: EncryptPhraseFormProps) {
  const router = useRouter()
  
  const { loginWithClearMnemonic } = useWalletAuth()
  const vault = useSecureStorage()

  const [step, setStep] = useState<"create" | "confirm">("create")
  const [tempPin, setTempPin] = useState("")

  const [shake, setShake] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [subtitle, setSubtitle] = useState("Для защиты ключей и подтверждения операций")

  const handlePinComplete = async (pin: string, clearPin: () => void) => {
    setIsLocked(true)

    // Используем предсказуемый промис задержки
    await new Promise(resolve => setTimeout(resolve, 300))

    if (step === "create") {
      setTempPin(pin)
      clearPin()
      setStep("confirm")
      setSubtitle("Коды должны полностью совпадать")
      setIsLocked(false)
    } else {
      if (pin === tempPin) {
        try {
          // 🛡 ЖЕСТКИЙ ФИЛЬТР: Проверяем, что фраза валидна перед шифрованием
          const cleanPhrase = phraseToEncrypt.trim().toLowerCase().replace(/\s+/g, " ")
          const wordsCount = cleanPhrase.split(" ").filter(Boolean).length

          // Строгая проверка: только 24 слова
          if (wordsCount !== 24) {
            throw new Error("Переданная фраза повреждена или не содержит 24 слова")
          }

          // 1. Шифруем
          const encryptedData = await encryptMnemonic(cleanPhrase, pin)

          // 2. Сохраняем на жесткий диск через Zustand (localStorage)
          vault.saveEncryptedMnemonic(encryptedData)

          // 3. Одновременно поднимаем сессию в оперативке (sessionStorage)
          await loginWithClearMnemonic(cleanPhrase)

          onAuthComplete()
          router.push("/dashboard")
        } catch (err: any) {
          console.error("❌ Криптографическая ошибка при шифровании фразы:", err)
          alert(`Ошибка: ${err.message || err}`)

          setIsError(true)
          setTimeout(() => {
            setIsError(false)
            setIsLocked(false)
            setStep("create")
            clearPin()
            setTempPin("")
            setSubtitle("Для защиты ключей и подтверждения операций")
          }, 1200)
        }
      } else {
        console.warn("❌ Ошибка: Введенные ПИН-коды не совпадают!")
        setIsError(true)
        setShake(true)
        setSubtitle("ПИН-коды не совпадают! Попробуй еще раз")

        setTimeout(() => setShake(false), 300)
        setTimeout(() => {
          setIsError(false)
          setIsLocked(false)
          setStep("create")
          clearPin()
          setTempPin("")
          setSubtitle("Для защиты ключей и подтверждения операций")
        }, 1200)
      }
    }
  }

  return (
    <div className="h-[450px] w-full">
      <PinCodeLayout
        title={step === "create" ? "Придумай ПИН-код" : "Повтори ПИН-код"}
        subtitle={subtitle}
        isError={isError}
        isLocked={isLocked}
        shake={shake}
        onPinComplete={handlePinComplete}
      />
    </div>
  )
}
