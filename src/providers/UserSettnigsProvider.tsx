'use client'

import React, { createContext, useContext, useState } from 'react'
import { useStore } from 'zustand'
import { createUserSettingsStore, UserSettingsProps, UserSettingsState, cookieStorageApi } from '@/store/useUserSettingsStore'

type UserSettingsStoreInstance = ReturnType<typeof createUserSettingsStore>

const StoreContextInstance = createContext<UserSettingsStoreInstance | undefined>(undefined)

// 🛡️ СТАБИЛЬНАЯ ССЫЛКА: Храним ссылку на инстанс стора для не-реактивного чтения в функциях (getState)
export let globalUserSettingsStore: UserSettingsStoreInstance | null = null

interface ProviderProps {
  children: React.ReactNode
  serverSettings: UserSettingsProps
}

export function UserSettingsContextProvider({ children, serverSettings }: ProviderProps) {
  // Инициализируем инстанс стора строго один раз при F5
  const [store] = useState(() => {
    const newStore = createUserSettingsStore(serverSettings)
    globalUserSettingsStore = newStore // Записываем инстанс в глобальную переменную на клиенте
    return newStore
  })

  const network = useStore(store, (state) => state.network)
  const language = useStore(store, (state) => state.language)

  React.useEffect(() => {
    cookieStorageApi.setItem('xchia-network', network)
    cookieStorageApi.setItem('xchia-lang', language)
  }, [network, language])

  return (
    <StoreContextInstance.Provider value={store}>
      {children}
    </StoreContextInstance.Provider>
  )
}

// Хук для РЕАКТИВНОГО чтения в компонентах (верстке)
export function useUserSettingsStore<T>(selector: (state: UserSettingsState) => T): T {
  const store = useContext(StoreContextInstance)
  if (!store) {
    throw new Error('useUserSettingsStore должен использоваться строго внутри UserSettingsContextProvider')
  }
  return useStore(store, selector)
}
