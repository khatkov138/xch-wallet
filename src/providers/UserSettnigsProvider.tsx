'use client'

import React, { createContext, useContext, useState } from 'react'
import { useStore } from 'zustand'
import { createUserSettingsStore, UserSettingsProps, UserSettingsState } from '@/store/useUserSettingsStore'

type UserSettingsStoreInstance = ReturnType<typeof createUserSettingsStore>
const StoreContextInstance = createContext<UserSettingsStoreInstance | undefined>(undefined)
export let globalUserSettingsStore: UserSettingsStoreInstance | null = null

interface ProviderProps {
  children: React.ReactNode
  serverSettings: Partial<UserSettingsProps>
}

export function UserSettingsContextProvider({ children, serverSettings }: ProviderProps) {
  const [store] = useState(() => {
    const newStore = createUserSettingsStore(serverSettings)
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
  if (!store) throw new Error('useUserSettingsStore строго внутри UserSettingsContextProvider')
  return useStore(store, selector)
}
