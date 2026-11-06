'use client'

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { useWalletFees } from "@/hooks/useWalletFees"
import { selectChiaCoins } from "./ChiaCoinSelection"
import { formatMojoToXchString } from "@/lib/utils"

type FeeTier = "low" | "medium" | "high"

interface SendModalContextType {
  targetAddress: string
  setTargetAddress: React.Dispatch<React.SetStateAction<string>>
  amount: string
  setAmount: React.Dispatch<React.SetStateAction<string>>
  customFeeMojo: string
  setCustomFeeMojo: React.Dispatch<React.SetStateAction<string>>
  pin: string
  setPin: React.Dispatch<React.SetStateAction<string>>
  selectedTier: FeeTier
  setSelectedTier: React.Dispatch<React.SetStateAction<FeeTier>>
  step: 1 | 2 | 3
  setStep: React.Dispatch<React.SetStateAction<1 | 2 | 3>>
  statusMessage: string
  setStatusMessage: React.Dispatch<React.SetStateAction<string>>
  preparedSpendData: any
  setPreparedSpendData: React.Dispatch<React.SetStateAction<any>>
  localSnapshot: any
  setLocalSnapshot: React.Dispatch<React.SetStateAction<any>>
  txResponseData: any
  setTxResponseData: React.Dispatch<React.SetStateAction<any>>
  realXCHStr: string
  dynamicFees: any
  getFeeInXchString: () => string
  getTotalOutflowString: () => string
  handleSetMax: () => void
  resetAll: () => void
  onCloseForm: () => void // Изолированный метод закрытия без пропсов
}

const SendModalContext = createContext<SendModalContextType | undefined>(undefined)

export function SendModalProvider({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  const [targetAddress, setTargetAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedTier, setSelectedTier] = useState<FeeTier>("medium")
  const [customFeeMojo, setCustomFeeMojo] = useState("0")
  const [pin, setPin] = useState("")
  
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [statusMessage, setStatusMessage] = useState("")
  const [preparedSpendData, setPreparedSpendData] = useState<any>(null)
  const [localSnapshot, setLocalSnapshot] = useState<any>(null)
  const [txResponseData, setTxResponseData] = useState<any>(null)

  const { unspentCoins, realXCHStr } = useWalletDashboard()

  const estimatedSpendsCount = useMemo(() => {
    if (!amount) return 1
    const selectedCoins = selectChiaCoins(amount, unspentCoins)
    return Math.max(1, selectedCoins.length)
  }, [amount, unspentCoins])

  const { data: dynamicFees } = useWalletFees(isOpen, estimatedSpendsCount)

  // Атомарный сброс всех стейтов
  const resetAll = useCallback(() => {
    setTargetAddress("")
    setAmount("")
    setSelectedTier("medium")
    setCustomFeeMojo("0")
    setPin("")
    setStep(1)
    setStatusMessage("")
    setPreparedSpendData(null)
    setLocalSnapshot(null)
    setTxResponseData(null)
  }, [])

  // Централизованная функция: сброс + закрытие
  const handleCloseAndReset = useCallback(() => {
    resetAll()
    onClose()
  }, [onClose, resetAll])

  // Автосброс стейтов, если модалка закрывается извне (например, по клику на бэкдроп)
  useEffect(() => { 
    if (!isOpen) resetAll() 
  }, [isOpen, resetAll])

  // Автоподстановка котировок комиссии ноды
  useEffect(() => {
    const fees = dynamicFees as Record<FeeTier, any> | undefined
    if (fees && fees[selectedTier]) {
      setCustomFeeMojo(String(fees[selectedTier].mojo))
    }
  }, [selectedTier, dynamicFees])

  const getFeeInXchString = () => {
    try {
      const mojoBI = BigInt(customFeeMojo.trim())
      return mojoBI === 0n ? "0 XCH" : formatMojoToXchString(mojoBI)
    } catch { return "0 XCH" }
  }
  
  const getTotalOutflowString = () => {
    if (!amount) return "0 XCH"
    return `${amount.trim().replace(",", ".")} XCH`
  }

  const handleSetMax = () => {
    if (realXCHStr && realXCHStr !== "0.0000") setAmount(realXCHStr)
  }

  return (
    <SendModalContext.Provider value={{
      targetAddress, setTargetAddress, amount, setAmount, customFeeMojo, setCustomFeeMojo, pin, setPin,
      selectedTier, setSelectedTier, step, setStep, statusMessage, setStatusMessage,
      preparedSpendData, setPreparedSpendData, localSnapshot, setLocalSnapshot, txResponseData, setTxResponseData,
      realXCHStr: realXCHStr || "0.0000", dynamicFees, getFeeInXchString, getTotalOutflowString, handleSetMax, resetAll,
      onCloseForm: handleCloseAndReset
    }}>
      {children}
    </SendModalContext.Provider>
  )
}

export const useSendModalContext = () => {
  const context = useContext(SendModalContext)
  if (!context) throw new Error("useSendModalContext должен использоваться строго внутри SendModalProvider")
  return context
}
