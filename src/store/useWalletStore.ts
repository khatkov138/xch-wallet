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
  activeIndexes: string // 🎯 Храним строку с живыми индексами балансов: "0,169,170"
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  startSession: (pkHex: string, timeoutMs: number) => void
  updateActivity: (timeoutMs: number) => void
  setScreenLocked: (status: boolean) => void
  setVerifying: (status: boolean) => void
  setActiveIndexes: (indexes: string) => void // 🎯 Экшен для обновления активных индексов
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
      activeIndexes: '', // 🎯 Инициализируем пустой строкой для Heavy-скана при первом запуске
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      startSession: (pkHex, timeoutMs) => {
        const now = Date.now()
        set({
          unhardenedPkHex: pkHex,
          isScreenLocked: false,
          isVerifying: false,
          lastActivityAt: now,
          expiresAt: now + timeoutMs,
          activeIndexes: '' // Сбрасываем при новом входе для полной синхронизации
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
      
      setActiveIndexes: (indexes) => set({ activeIndexes: indexes }), // 🎯 Обновление стейта индексов
      
      endSession: () => set({
        unhardenedPkHex: '',
        isScreenLocked: true,
        isVerifying: false,
        expiresAt: null,
        lastActivityAt: null,
        activeIndexes: '' // 🎯 Очищаем при выходе
      })
    }),
    {
      name: 'xcha-active-session',
      storage: createJSONStorage(getSessionStorage), 
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)
