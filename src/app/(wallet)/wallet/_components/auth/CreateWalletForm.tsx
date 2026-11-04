'use client'

import React, { useState } from "react"
import { PinCodeLayout } from "@/components/PinCodeLayout"
import { useWalletAuth } from "@/hooks/useWalletAuth" 
import { useWalletContext } from "@/app/(wallet)/WalletContext"

interface EncryptPhraseFormProps {
  phraseToEncrypt: string
}

export function CreateWalletForm({ phraseToEncrypt }: EncryptPhraseFormProps) {
  const { onWalletCreated } = useWalletContext()
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
          await createNewWallet(phraseToEncrypt, pin)
          onWalletCreated()
        } catch (err: any) {
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
