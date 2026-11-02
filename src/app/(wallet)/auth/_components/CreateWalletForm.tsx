'use client'

import React, { useState, useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"

import { PinCodeLayout } from "@/components/PinCodeLayout"
import { useWalletAuth } from "@/hooks/useWalletAuth" 
import { useSecureStorage } from "@/store/useWalletStore" 
import { encryptMnemonic } from "@/lib/utils/crypto" 

interface EncryptPhraseFormProps {
  phraseToEncrypt: string
}

export function CreateWalletForm({ phraseToEncrypt }: EncryptPhraseFormProps) {
  const router = useRouter()
  
  const { loginWithClearMnemonic } = useWalletAuth()
  const vault = useSecureStorage()

  const [step, setStep] = useState<"create" | "confirm">("create")
  const [tempPin, setTempPin] = useState("")

  const [shake, setShake] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [subtitle, setSubtitle] = useState("Для защиты ключей и подтверждения операций")

  // 🛡️ ФИКС ГИДРАТАЦИИ/АВТОКОМПЛИТА: Предзагружаем дашборд, чтобы роутер Next.js 
  // не вызывал долгий ленивый use() внутри асинхронного события.
  useEffect(() => {
    router.prefetch("/dashboard")
  }, [router])

  const handlePinComplete = async (pin: string, clearPin: () => void) => {
    setIsLocked(true)

    // Используем предсказуемый промис задержки для бруталистичного UX
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

          // Строгая проверка: только 24 слова для стандартов Chia (BIP-39 / BLS12-381)
          if (wordsCount !== 24) {
            throw new Error("Фраза повреждена или не содержит 24 слова")
          }

          // 1. Криптографическое шифрование мнемоники
          const encryptedData = await encryptMnemonic(cleanPhrase, pin)

          // 2. Сохраняем ЗАШИФРОВАННЫЙ вольт на диск
          await vault.saveEncryptedMnemonic(encryptedData)

          // 3. Поднимаем сессию в оперативной памяти (Строго RAM через Zustand, без утечек в Storage)
          await loginWithClearMnemonic(cleanPhrase)

          // 4. 👍 ЖЕСТКИЙ ФИКС: Оборачиваем атомарный переход в startTransition
          // Это изолирует планирование рендеринга новой страницы от текущего стейта формы
          startTransition(() => {
            router.replace("/dashboard")
          })
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
