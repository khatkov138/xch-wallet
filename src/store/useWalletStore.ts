import { create } from 'zustand'

interface WalletState {
  walletAddress: string;
  decryptedPhrase: string;
  isScreenLocked: boolean;
  isVerifying: boolean;
  setWalletData: (address: string, phrase: string) => void;
  lockWallet: () => void;
  setVerifying: (status: boolean) => void;
  setScreenLocked: (status: boolean) => void;
}
 
export const useWalletStore = create<WalletState>((set) => ({
  walletAddress: '',
  decryptedPhrase: '',
  isScreenLocked: true, // По умолчанию всегда заблокировано для безопасности
  isVerifying: true, 

  setWalletData: (address, phrase) => set({ 
    walletAddress: address, 
    decryptedPhrase: phrase,
    isScreenLocked: false 
  }),

  lockWallet: () => {
    sessionStorage.removeItem("xcha_session_expires");
    set({ 
      walletAddress: '', 
      decryptedPhrase: '', 
      isScreenLocked: true 
    });
  },

  setVerifying: (status) => set({ isVerifying: status }),
  setScreenLocked: (status) => set({ isScreenLocked: status })
}));
