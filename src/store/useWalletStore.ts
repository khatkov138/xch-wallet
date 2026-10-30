'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const dummyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}

const getBrowserStorage = () => (typeof window !== 'undefined' ? localStorage : dummyStorage)

// ==========================================
// 1. SECURE STORAGE (Навсегда на диске)
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
      storage: createJSONStorage(getBrowserStorage),
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)

// ==========================================
// 2. WALLET SESSION (Реактивная сессия)
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
        // Обновляем таймер только если сессия реально активна
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
      storage: createJSONStorage(getBrowserStorage),
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)
