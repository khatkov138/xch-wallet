import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { decryptMnemonic } from "@/lib/crypto" // ТВОЯ РОДНАЯ ФУНКЦИЯ ДЕКРИПТА

interface WalletState {
  walletAddress: string;
  decryptedPhrase: string; // Живет СТРОГО в оперативной памяти JS
  isScreenLocked: boolean;
  isVerifying: boolean;
  setWalletData: (address: string, phrase?: string) => void;
  lockWallet: () => void;
  setVerifying: (status: boolean) => void;
  setScreenLocked: (status: boolean) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      walletAddress: '',
      decryptedPhrase: '', 
      isScreenLocked: true, 
      isVerifying: true,

      setWalletData: (address, phrase) => set({
        walletAddress: address,
        decryptedPhrase: phrase || '', // Записываем чистую фразу в оперативку
        isScreenLocked: false
      }),

      lockWallet: () => {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem("xcha-wallet-session");
          sessionStorage.removeItem("xcha_session_expires");
          sessionStorage.removeItem("xcha_session_pin"); // Стираем ПИН
        }
        set({
          walletAddress: '',
          decryptedPhrase: '', // Полностью очищаем память
          isScreenLocked: true
        });
      },

      setVerifying: (status) => set({ isVerifying: status }),
      setScreenLocked: (status) => set({ isScreenLocked: status })
    }),
    {
      name: 'xcha-wallet-session',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        
        return {
          setItem: (name, value) => {
            // Сохраняем в sessionStorage штатно (благодаря partialize там не будет decryptedPhrase)
            sessionStorage.setItem(name, value);
          },
          
          getItem: (name) => {
            const value = sessionStorage.getItem(name);
            if (!value) return null;
            
            try {
              const parsed = JSON.parse(value);
              const pin = sessionStorage.getItem("xcha_session_pin");
              const encryptedMnemonic = localStorage.getItem("xcha_mnemonic") || "";
              
              // ИСПРАВЛЕНИЕ: Если произошел F5, сессия валидна, но фразы в оперативной памяти нет,
              // мы на лету берем зашифрованный сид из localStorage, расшифровываем его ПИН-кодом из сессии
              // и восстанавливаем строго в оперативную память приложения!
              if (parsed.state && pin && encryptedMnemonic && !parsed.state.decryptedPhrase) {
                decryptMnemonic(encryptedMnemonic, pin)
                  .then(clearText => {
                    if (clearText) {
                      // Закидываем фразу исключительно в runtime-стейт
                      useWalletStore.setState({ decryptedPhrase: clearText });
                    }
                  })
                  .catch((err) => {
                    console.error("Критическая ошибка авто-восстановления сида при F5:", err);
                  });
              }
              return JSON.stringify(parsed);
            } catch (e) {
              return value;
            }
          },
          removeItem: (name) => sessionStorage.removeItem(name)
        };
      }),
      // ГЛАВНЫЙ ФИКС БЕЗОПАСНОСТИ: В sessionStorage улетают ТОЛЬКО адрес и статус лока.
      // Поле decryptedPhrase ИСКЛЮЧЕНО из персиста и никогда не попадет на "диск" вкладки!
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        isScreenLocked: state.isScreenLocked,
      }),
    }
  )
)
