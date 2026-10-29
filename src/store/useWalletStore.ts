import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface WalletState {
  walletAddress: string;
  unhardenedPkHex: string; // Безопасный публичный ключ для TanStack Query
  isScreenLocked: boolean;
  isVerifying: boolean;
  setWalletData: (address: string, pkHex: string) => void;
  setScreenLocked: (status: boolean) => void;
  setVerifying: (status: boolean) => void;
  clearStore: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      walletAddress: '',
      unhardenedPkHex: '',
      isScreenLocked: true, 
      isVerifying: true,

      setWalletData: (address, pkHex) => set({
        walletAddress: address,
        unhardenedPkHex: pkHex,
        isScreenLocked: false
      }),

      setScreenLocked: (status) => set({ isScreenLocked: status }),
      setVerifying: (status) => set({ isVerifying: status }),
      
      clearStore: () => set({
        walletAddress: '',
        unhardenedPkHex: '',
        isScreenLocked: true,
        isVerifying: false
      })
    }),
    {
      name: 'xcha-wallet-session',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? sessionStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} })),
      // В sessionStorage улетает вся структура, так как в ней больше нет приватных данных!
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        unhardenedPkHex: state.unhardenedPkHex,
        isScreenLocked: state.isScreenLocked,
      }),
    }
  )
)
