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

const dummyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const getSessionStorage = () => (isClient ? sessionStorage : dummyStorage)

// ==========================================
// 1. SECURE STORAGE (Внутри базы данных IndexedDB)
// ==========================================
interface SecureStorageState {
  encryptedMnemonic: string
  hasWallet: boolean
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  saveEncryptedMnemonic: (encryptedHex: string) => void
  deleteWallet: () => void
}

export const useSecureStorage = create<SecureStorageState>()(
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

// ==========================================
// 2. WALLET SESSION (Реактивная сессия в sessionStorage)
// ==========================================
interface WalletSessionState {
  unhardenedPkHex: string
  isScreenLocked: boolean
  isVerifying: boolean
  noWalletMode: boolean // 🎯 Добавлено в интерфейс
  expiresAt: number | null
  lastActivityAt: number | null
  activeIndexes: string 
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  startSession: (pkHex: string, timeoutMs: number) => void
  updateActivity: (timeoutMs: number) => void
  setScreenLocked: (status: boolean) => void
  setVerifying: (status: boolean) => void
  setNoWalletMode: (status: boolean) => void // 🎯 Добавлено в интерфейс
  setActiveIndexes: (indexes: string) => void 
  endSession: () => void
}

export const useWalletSession = create<WalletSessionState>()(
  persist(
    (set, get) => ({
      unhardenedPkHex: '',
      isScreenLocked: true, 
      isVerifying: true,    
      noWalletMode: false, // 🎯 Инициализация флага стейт-машины
      expiresAt: null,
      lastActivityAt: null,
      activeIndexes: '', 
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      startSession: (pkHex, timeoutMs) => {
        const now = Date.now()
        set({
          unhardenedPkHex: pkHex,
          isScreenLocked: false,
          isVerifying: false,
          noWalletMode: false, // Сбрасываем при успешном старте сессии
          lastActivityAt: now,
          expiresAt: now + timeoutMs,
          activeIndexes: '' 
        })
      },

      updateActivity: (timeoutMs) => {
        if (!get().unhardenedPkHex) return
        const now = Date.now()
        set({
          lastActivityAt: now,
          expiresAt: now + timeoutMs
        })
      },

      setScreenLocked: (status) => set({ isScreenLocked: status }),
      setVerifying: (status) => set({ isVerifying: status }),
      setNoWalletMode: (status) => set({ noWalletMode: status }), // 🎯 Сеттер режима
      
      setActiveIndexes: (indexes) => set({ activeIndexes: indexes }), 
      
      endSession: () => set({
        unhardenedPkHex: '',
        isScreenLocked: true,
        isVerifying: false,
        noWalletMode: false, // 🎯 Мягкий сброс стейт-машины при логауте
        expiresAt: null,
        lastActivityAt: null,
        activeIndexes: '' 
      })
    }),
    {
      name: 'xcha-active-session',
      storage: createJSONStorage(getSessionStorage), 
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)
