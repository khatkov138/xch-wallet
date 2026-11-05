'use client'

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react"
import { useWalletDashboard } from "@/hooks/useWalletDashboard"
import { useWalletFees } from "@/hooks/useWalletFees"
import { useBuildBundleMutation } from "./mutations/useBuildBundleMutation"
import { useSendTxMutation } from "./mutations/useSendTxMutation"
import { selectChiaCoins } from "./ChiaCoinSelection"
import { formatMojoToXchString } from "@/lib/utils"

type FeeTier = "low" | "medium" | "high"

// 🎯 Строгий интерфейс для контекста, чтобы убрать все ошибки TypeScript
interface SendModalContextType {
  targetAddress: string
  setTargetAddress: React.Dispatch<React.SetStateAction<string>>
  amount: string
  setAmount: React.Dispatch<React.SetStateAction<string>>
  customFeeMojo: string
  setCustomFeeMojo: React.Dispatch<React.SetStateAction<string>>
  pin: string
  setPin: React.Dispatch<React.SetStateAction<string>>
  step: 1 | 2 | 3
  setStep: React.Dispatch<React.SetStateAction<1 | 2 | 3>>
  statusMessage: string
  setStatusMessage: React.Dispatch<React.SetStateAction<string>>
  preparedSpendData: any
  setPreparedSpendData: React.Dispatch<React.SetStateAction<any>>
  localSnapshot: any
  setLocalSnapshot: React.Dispatch<React.SetStateAction<any>>
  setTxResponseData: React.Dispatch<React.SetStateAction<any>>
  setSelectedTier: React.Dispatch<React.SetStateAction<FeeTier>>
  selectedTier: FeeTier
  handleSubmit: (e: React.FormEvent) => void
  realXCHStr: string
  dynamicFees: any
  getFeeInXchString: () => string
  getTotalOutflowString: () => string
  handleSetMax: () => void
  txResponseData: any
  loading: boolean
  txStatus: "IDLE" | "PENDING" | "SUCCESS" | "ERROR"
  txId: string | null
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

  const sentTransactionsRef = useRef<Set<string>>(new Set())
  const { unspentCoins, addresses, realXCHStr } = useWalletDashboard()

  const estimatedSpendsCount = useMemo(() => {
    const selectedCoins = selectChiaCoins(amount, unspentCoins)
    return Math.max(1, selectedCoins.length)
  }, [amount, unspentCoins])

  const { data: dynamicFees } = useWalletFees(isOpen, estimatedSpendsCount)

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
    setTxResponseData 
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
    // Явно приводим к Record<FeeTier, any>, чтобы TS разрешил динамический индекс
    const fees = dynamicFees as Record<FeeTier, any> | undefined;
    
    if (fees && fees[selectedTier]) {
      setCustomFeeMojo(String(fees[selectedTier].mojo))
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
      realXCHStr: realXCHStr || "0.0000", // Защита от undefined
      dynamicFees,
      getFeeInXchString,      
      getTotalOutflowString,   
      handleSetMax,           
      txResponseData, 
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
