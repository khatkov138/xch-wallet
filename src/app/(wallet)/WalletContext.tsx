'use client'

import React, { createContext, useContext, useState, startTransition } from 'react'
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useWalletNetwork } from "@/store/useWalletStore"
import { useRouter } from "next/navigation"

interface WalletContextProps {
  network: 'mainnet' | 'testnet11'
  isExiting: boolean
  triggerGlobalLogout: (onClear: () => void) => void
}

const WalletContextInstance = createContext<WalletContextProps | undefined>(undefined)

export function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const network = useWalletNetwork()
  const { hardResetWallet } = useWalletAuth()
  const [isExiting, setIsExiting] = useState(false)
  const router = useRouter()

  const triggerGlobalLogout = (onClear: () => void) => {
    setIsExiting(true)
    onClear()
    startTransition(() => {
      hardResetWallet()
    })
    router.replace("/")
  }

  return (
    <WalletContextInstance.Provider value={{ network, isExiting, triggerGlobalLogout }}>
      {children}
    </WalletContextInstance.Provider>
  )
}

export function useWalletContext() {
  const context = useContext(WalletContextInstance)
  if (!context) {
    throw new Error('useWalletContext должен использоваться строго внутри WalletContextProvider')
  }
  return context
}
