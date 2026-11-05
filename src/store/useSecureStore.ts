'use client'

import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

const isClient = typeof window !== 'undefined'

const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!isClient) return null
    return (await idbGet(name)) || null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!isClient) return
    await idbSet(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    if (!isClient) return
    await idbDel(name)
  },
}

interface SecureStorageStoreState {
  encryptedMnemonic: string
  hasWallet: boolean
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  saveEncryptedMnemonic: (encryptedHex: string) => void
  deleteWallet: () => void
}

export const useSecureStore = create<SecureStorageStoreState>()(
  persist(
    (set) => ({
      encryptedMnemonic: '',
      hasWallet: false,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      saveEncryptedMnemonic: (encryptedHex) => set({
        encryptedMnemonic: encryptedHex,
        hasWallet: true
      }),

      deleteWallet: () => set({
        encryptedMnemonic: '',
        hasWallet: false
      })
    }),
    {
      name: 'xcha-secure-vault',
      storage: createJSONStorage(() => indexedDBStorage), 
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)
