'use client'

import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

// 🛡️ 1. КАСТОМНЫЙ ДВИЖОК ДЛЯ INDEXEDDB (Через idb-keyval)
const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await idbGet(name)) || null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await idbSet(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await idbDel(name)
  },
}

// 🛡️ 2. БЕЗОПАСНЫЙ ВЫБОР ДЛЯ СЕССИИ (Используем sessionStorage вместо localStorage)
// Если вкладку закроют — публичный ключ сессии сотрется сам автоматически!
const dummyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const getSessionStorage = () => (typeof window !== 'undefined' ? sessionStorage : dummyStorage)


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
      // СЮДА ДРОПАЕМ НАШ АСИНХРОННЫЙ INDEXEDDB СТОРАДЖ!
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
  expiresAt: number | null
  lastActivityAt: number | null
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  startSession: (pkHex: string, timeoutMs: number) => void
  updateActivity: (timeoutMs: number) => void
  setScreenLocked: (status: boolean) => void
  setVerifying: (status: boolean) => void
  endSession: () => void
}

export const useWalletSession = create<WalletSessionState>()(
  persist(
    (set, get) => ({
      unhardenedPkHex: '',
      isScreenLocked: true, 
      isVerifying: true,    
      expiresAt: null,
      lastActivityAt: null,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      startSession: (pkHex, timeoutMs) => {
        const now = Date.now()
        set({
          unhardenedPkHex: pkHex,
          isScreenLocked: false,
          isVerifying: false,
          lastActivityAt: now,
          expiresAt: now + timeoutMs
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
      
      endSession: () => set({
        unhardenedPkHex: '',
        isScreenLocked: true,
        isVerifying: false,
        expiresAt: null,
        lastActivityAt: null
      })
    }),
    {
      name: 'xcha-active-session',
      // Переводим сессию на sessionStorage: закрыл вкладку — сессии пиздец (это эталон безопасности)
      storage: createJSONStorage(getSessionStorage), 
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)
