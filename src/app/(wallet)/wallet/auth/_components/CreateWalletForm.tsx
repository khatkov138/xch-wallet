'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { PinCodeLayout } from "@/components/PinCodeLayout"
import { useWalletAuth } from "@/hooks/useWalletAuth" 

interface EncryptPhraseFormProps {
  phraseToEncrypt: string
}

export function CreateWalletForm({ phraseToEncrypt }: EncryptPhraseFormProps) {
  const router = useRouter()
  const { createNewWallet } = useWalletAuth()

  const [step, setStep] = useState<"create" | "confirm">("create")
  const [tempPin, setTempPin] = useState("")

  const [shake, setShake] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [subtitle, setSubtitle] = useState("Для защиты ключей и подтверждения операций")

 

  const handlePinComplete = async (pin: string, clearPin: () => void) => {
    setIsLocked(true)

  
    if (step === "create") {
      setTempPin(pin)
      clearPin()
      setStep("confirm")
      setSubtitle("Коды должны полностью совпадать")
      setIsLocked(false)
    } else {
      if (pin === tempPin) {
        try {
          // Вызываем метод хука — он сам всё проверит, зашифрует и затрет за собой память
          await createNewWallet(phraseToEncrypt, pin)

          // Прямой роуш-пуш без транзишна, как ты и просил
          router.push("/wallet")
          
        } catch (err: any) {
          console.error("❌ Криптографическая ошибка при шифровании фразы:", err)
          
          setIsError(true)
          setSubtitle(err.message || "Критическая ошибка шифрования ключей")

          setTimeout(() => {
            setIsError(false)
            setIsLocked(false)
            setStep("create")
            clearPin()
            setTempPin("")
            setSubtitle("Для защиты ключей и подтверждения операций")
          }, 1500)
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
        }, 1500)
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
