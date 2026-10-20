import { create } from 'zustand'

interface WalletState {
  walletAddress: string;
  isScreenLocked: boolean;
  isVerifying: boolean;
  // Сохраняем сигнатуру метода для обратной совместимости, но игнорируем второй аргумент
  setWalletData: (address: string, phrase?: string) => void;
  lockWallet: () => void;
  setVerifying: (status: boolean) => void;
  setScreenLocked: (status: boolean) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  walletAddress: '',
  isScreenLocked: true, // По умолчанию всегда заблокировано для безопасности
  isVerifying: true,

  setWalletData: (address) => set({
    walletAddress: address,
    isScreenLocked: false
  }),

  lockWallet: () => {
    // Безопасное уничтожение сессионных меток
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem("xcha_session_expires");
    }
    set({
      walletAddress: '',
      isScreenLocked: true
    });
  },

  setVerifying: (status) => set({ isVerifying: status }),
  setScreenLocked: (status) => set({ isScreenLocked: status })
}));
