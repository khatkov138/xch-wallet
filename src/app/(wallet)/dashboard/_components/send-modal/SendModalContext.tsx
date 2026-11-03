'use client'

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { useWalletFees } from "@/hooks/useWalletFees"
import { useBuildBundleMutation } from "./mutations/useBuildBundleMutation"
import { useSendTxMutation } from "./mutations/useSendTxMutation"
import { selectChiaCoins } from "./ChiaCoinSelection"
import { formatMojoToXchString } from "@/lib/utils"

type FeeTier = "low" | "medium" | "high"

const SendModalContext = createContext<any>(undefined)

export function SendModalProvider({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  const [targetAddress, setTargetAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedTier, setSelectedTier] = useState<FeeTier>("medium")
  const [customFeeMojo, setCustomFeeMojo] = useState("0")
  const [pin, setPin] = useState("")
  
  // 🎯 Изменяем тип шага, допуская Шаг 3 (Экран успеха и поллинга сети)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [statusMessage, setStatusMessage] = useState("")
  const [preparedSpendData, setPreparedSpendData] = useState<any>(null)
  const [localSnapshot, setLocalSnapshot] = useState<any>(null)
  
  // 🎯 Новое состояние для хранения сырого JSON-ответа отправленной транзакции
  const [txResponseData, setTxResponseData] = useState<any>(null)

  const sentTransactionsRef = useRef<Set<string>>(new Set())
  const { unspentCoins, addresses, realXCHStr } = useWalletDashboard()

  const estimatedSpendsCount = useMemo(() => {
    const selectedCoins = selectChiaCoins(amount, unspentCoins)
    return Math.max(1, selectedCoins.length)
  }, [amount, unspentCoins])

  const { data: dynamicFees } = useWalletFees(isOpen, estimatedSpendsCount)

  // self-ссылка включает все мутаторы стейтов для изолированных файлов мутаций
  const self = {
    targetAddress, 
    setTargetAddress, 
    amount, 
    setAmount,       
    customFeeMojo, 
    setCustomFeeMojo,
    pin, 
    setPin, 
    step, 
    setStep, 
    statusMessage, 
    setStatusMessage, 
    preparedSpendData, 
    setPreparedSpendData, 
    localSnapshot, 
    setLocalSnapshot,
    setTxResponseData // 🎯 Передаем мутатор ответа, чтобы useSendTxMutation мог его вызвать
  }

  const buildBundleMutation = useBuildBundleMutation(self, unspentCoins, addresses)
  const sendTxMutation = useSendTxMutation(self, sentTransactionsRef)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (buildBundleMutation.isPending || sendTxMutation.isPending) return
    if (step === 1) buildBundleMutation.mutate()
    else sendTxMutation.mutate()
  }

  const resetAll = () => {
    setTargetAddress(""); setAmount(""); setSelectedTier("medium"); setCustomFeeMojo("0"); setPin("")
    setStep(1); setStatusMessage(""); setPreparedSpendData(null); setLocalSnapshot(null); setTxResponseData(null)
    buildBundleMutation.reset(); sendTxMutation.reset(); sentTransactionsRef.current.clear()
  }

  useEffect(() => { if (!isOpen) resetAll() }, [isOpen])

  useEffect(() => {
    if (dynamicFees && dynamicFees[selectedTier]) {
      setCustomFeeMojo(String(dynamicFees[selectedTier].mojo))
    }
  }, [selectedTier, dynamicFees])

  const getFeeInXchString = () => {
    try {
      const mojoBI = BigInt(customFeeMojo.trim())
      return mojoBI === 0n ? "0 XCH" : formatMojoToXchString(mojoBI)
    } catch {
      return "0 XCH"
    }
  }
  
  const getTotalOutflowString = () => {
    if (!amount) return "0 XCH"
    return `${amount.trim().replace(",", ".")} XCH`
  }

  const handleSetMax = () => {
    if (realXCHStr && realXCHStr !== "0.0000") {
      setAmount(realXCHStr)
    }
  }

  const txStatusMap = { idle: "IDLE", pending: "PENDING", success: "SUCCESS", error: "ERROR" } as const

  return (
    <SendModalContext.Provider value={{
      ...self, 
      setSelectedTier, 
      selectedTier, 
      handleSubmit, 
      realXCHStr,
      dynamicFees,
      getFeeInXchString,      
      getTotalOutflowString,   
      handleSetMax,           
      txResponseData, // 🎯 Прокидываем наружу для чтения в SendStepThree
      loading: buildBundleMutation.isPending || sendTxMutation.isPending,
      txStatus: txStatusMap[sendTxMutation.status],
      txId: sendTxMutation.data?.tx_id ?? null
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
