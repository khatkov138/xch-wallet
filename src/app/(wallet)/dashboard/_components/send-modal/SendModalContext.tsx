'use client'

import React, { createContext, useContext, useState, useEffect, useMemo } from "react"

import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { useWalletFees } from "@/hooks/useWalletFees"
import { useWalletBalance } from "@/hooks/useWalletBalance"
import { useSendTransaction } from "./useSendTransaction"
import { selectChiaCoins } from "./ChiaCoinSelection"

type FeeTier = "low" | "medium" | "high"

interface SendModalContextType {
  targetAddress: string
  setTargetAddress: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  selectedTier: FeeTier
  setSelectedTier: (v: FeeTier) => void
  customFeeMojo: string
  setCustomFeeMojo: (v: string) => void
  pin: string
  setPin: (v: string) => void
  step: 1 | 2 
  setStep: React.Dispatch<React.SetStateAction<1 | 2>>
  loading: boolean
  statusMessage: string
  handleSubmit: (e: React.FormEvent) => void
  preparedSpendData: any
  balanceXCH: string
  realXCHStr: string
  dynamicFees: any
  getFeeInXchString: () => string
  getTotalOutflowString: () => string
  handleSetMax: () => void 
}

const SendModalContext = createContext<SendModalContextType | undefined>(undefined)

export function SendModalProvider({ 
  isOpen, 
  onClose, 
  children 
}: { 
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode 
}) {
  const [targetAddress, setTargetAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedTier, setSelectedTier] = useState<FeeTier>("medium")
  const [customFeeMojo, setCustomFeeMojo] = useState<string>("0")
  const [pin, setPin] = useState("")

  // Извлекаем стейты из глобальных хуков
  const { unspentCoins, addresses, realXCHStr } = useWalletDashboard() 
  const { balanceXCH } = useWalletBalance()

  // 🎯 РЕАКТИВНЫЙ РАСЧЕТ ВХОДОВ НА БАЗЕ ЕДИНОГО ХЕЛПЕРА (БЕЗ ДУБЛИРОВАНИЯ КОДА)
  const estimatedSpendsCount = useMemo(() => {
    const selectedCoins = selectChiaCoins(amount, unspentCoins)
    // Если массив пустой, по дефолту закладываем 1 монету для валидного расчета базовых комиссий
    return Math.max(1, selectedCoins.length)
  }, [amount, unspentCoins])

  // Передаем динамический count монет в ленивый кэш комиссий
  const { data: dynamicFees } = useWalletFees(isOpen, estimatedSpendsCount)

  // Инициализируем хук отправки транзакции
  const { 
    step, 
    setStep, 
    loading, 
    statusMessage, 
    handleSubmit, 
    resetHooksState, 
    preparedSpendData 
  } = useSendTransaction({
    targetAddress, amount, customFeeMojo, pin, setPin, onClose, unspentCoins, walletAddresses: addresses
  })

  // Холодный сброс всех стейтов формы при закрытии модального окна
  useEffect(() => {
    if (!isOpen) {
      setTargetAddress("")
      setAmount("")
      setSelectedTier("medium")
      setCustomFeeMojo("0")
      setPin("")
      resetHooksState()
    }
  }, [isOpen])

  // Автоматическая реактивная синхронизация customFeeMojo при переключении табов (Low/Medium/High)
  useEffect(() => {
    if (dynamicFees && dynamicFees[selectedTier]) {
      setCustomFeeMojo(String(dynamicFees[selectedTier].mojo))
    }
  }, [selectedTier, dynamicFees])

  // Безопасное форматирование Mojo в строку XCH без риска провалиться в экспоненциальный e-7 стейт
  const getFeeInXchString = () => {
    const mojo = parseFloat(customFeeMojo) || 0
    if (mojo === 0) return "0 XCH"
    return `${(mojo / 1e12).toFixed(12).replace(/\.?0+$/, "")} XCH`
  }
  
  const getTotalOutflowString = () => {
    const parsedAmount = parseFloat(amount.trim().replace(",", ".")) || 0
    return `${parsedAmount.toFixed(4)} XCH`
  }

  // Запись полной, атомарной 12-значной строки для вычищения баланса под ноль без округлений
  const handleSetMax = () => {
    if (realXCHStr && parseFloat(realXCHStr) > 0) {
      setAmount(realXCHStr)
    }
  }

  return (
    <SendModalContext.Provider value={{
      targetAddress, setTargetAddress, amount, setAmount, selectedTier, setSelectedTier,
      customFeeMojo, setCustomFeeMojo, pin, setPin, step, setStep, loading, statusMessage,
      handleSubmit, preparedSpendData, balanceXCH, realXCHStr, dynamicFees, getFeeInXchString,
      getTotalOutflowString, handleSetMax
    }}>
      {children}
    </SendModalContext.Provider>
  )
}

export function useSendModalContext() {
  const context = useContext(SendModalContext)
  if (!context) throw new Error("useSendModalContext должен использоваться строго внутри SendModalProvider")
  return context
}
