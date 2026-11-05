'use client'

import React, { createContext, useContext, useState } from 'react'
import { useStore } from 'zustand'
import { createUserSettingsStore, UserSettingsState } from '@/store/useUserSettingsStore'

type UserSettingsStoreInstance = ReturnType<typeof createUserSettingsStore>
const StoreContextInstance = createContext<UserSettingsStoreInstance | undefined>(undefined)
export let globalUserSettingsStore: UserSettingsStoreInstance | null = null

interface ProviderProps {
  children: React.ReactNode
  storeCookies: Array<{ name: string; value: string }>
}

export function UserSettingsContextProvider({ children, storeCookies }: ProviderProps) {
  const [store] = useState(() => {
    const newStore = createUserSettingsStore(storeCookies)
    globalUserSettingsStore = newStore 
    return newStore
  })

  return (
    <StoreContextInstance.Provider value={store}>
      {children}
    </StoreContextInstance.Provider>
  )
}

export function useUserSettingsStore<T>(selector: (state: UserSettingsState) => T): T {
  const store = useContext(StoreContextInstance)
  if (!store) {
    throw new Error('useUserSettingsStore должен использоваться строго внутри UserSettingsContextProvider')
  }
  return useStore(store, selector)
}
