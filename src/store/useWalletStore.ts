import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface WalletState {
  unhardenedPkHex: string; // Главный публичный ключ кошелька для генерации адресов и TanStack Query
  isScreenLocked: boolean;
  isVerifying: boolean;
  setWalletData: (pkHex: string) => void;
  setScreenLocked: (status: boolean) => void;
  setVerifying: (status: boolean) => void;
  clearStore: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      unhardenedPkHex: '',
      isScreenLocked: true, 
      isVerifying: true,

      // Принимаем только публичный ключ
      setWalletData: (pkHex) => set({
        unhardenedPkHex: pkHex,
        isScreenLocked: false
      }),

      setScreenLocked: (status) => set({ isScreenLocked: status }),
      setVerifying: (status) => set({ isVerifying: status }),
      
      clearStore: () => set({
        unhardenedPkHex: '',
        isScreenLocked: true,
        isVerifying: false
      })
    }),
    {
      name: 'xcha-wallet-session',
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' 
          ? sessionStorage 
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      // Сохраняем в сессию только ключ и статус блокировки экранa
      partialize: (state) => ({
        unhardenedPkHex: state.unhardenedPkHex,
        isScreenLocked: state.isScreenLocked,
      }),
    }
  )
)
