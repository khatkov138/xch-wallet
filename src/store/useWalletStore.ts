import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ==========================================
// 1. ХРАНИЛИЩЕ НА ДИСКЕ (localStorage)
// ==========================================
interface SecureStorageState {
  encryptedMnemonic: string;
  hasWallet: boolean;
  _hasHydrated: boolean; // 🔥 Добавили флаг готовности
  setHasHydrated: (state: boolean) => void;
  saveEncryptedMnemonic: (encryptedHex: string) => void;
  deleteWallet: () => void;
}

export const useSecureStorage = create<SecureStorageState>()(
  persist(
    (set) => ({
      encryptedMnemonic: '',
      hasWallet: false,
      _hasHydrated: false, // Изначально false

      setHasHydrated: (state) => set({ _hasHydrated: state }),
      saveEncryptedMnemonic: (encryptedHex) => set({ encryptedMnemonic: encryptedHex, hasWallet: true }),
      deleteWallet: () => set({ encryptedMnemonic: '', hasWallet: false })
    }),
    {
      name: 'xcha-secure-vault',
      storage: createJSONStorage(() => typeof window !== 'undefined' ? localStorage : dummyStorage),
      // 🔥 Переключаем флаг, когда стор считан с диска в браузере
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)

// ==========================================
// 2. ХРАНИЛИЩЕ СЕССИИ (sessionStorage)
// ==========================================
interface WalletSessionState {
  unhardenedPkHex: string;
  isScreenLocked: boolean;
  isVerifying: boolean;
  _hasHydrated: boolean; // 🔥 Добавили флаг готовности
  setHasHydrated: (state: boolean) => void;
  startSession: (pkHex: string) => void;
  setScreenLocked: (status: boolean) => void;
  setVerifying: (status: boolean) => void;
  endSession: () => void;
}

export const useWalletSession = create<WalletSessionState>()(
  persist(
    (set) => ({
      unhardenedPkHex: '',
      isScreenLocked: true, 
      isVerifying: true,
      _hasHydrated: false, // Изначально false

      setHasHydrated: (state) => set({ _hasHydrated: state }),
      startSession: (pkHex) => set({ unhardenedPkHex: pkHex, isScreenLocked: false, isVerifying: false }),
      setScreenLocked: (status) => set({ isScreenLocked: status }),
      setVerifying: (status) => set({ isVerifying: status }),
      endSession: () => set({ unhardenedPkHex: '', isScreenLocked: true, isVerifying: false })
    }),
    {
      name: 'xcha-active-session',
      storage: createJSONStorage(() => typeof window !== 'undefined' ? sessionStorage : dummyStorage),
      // 🔥 Переключаем флаг, когда сессия считана
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)

const dummyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
