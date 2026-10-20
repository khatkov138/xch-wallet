'use client'

import { useEffect, useCallback } from "react"
import { useWalletStore } from "@/store/useWalletStore"
import { generateChiaAddressFromMnemonic } from "@/lib/chia-crypto";

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 минут

export function useWalletAuth() {
  const {
    walletAddress,
    decryptedPhrase,
    isScreenLocked,
    isVerifying,
    setWalletData,
    lockWallet,
    setVerifying,
    setScreenLocked
  } = useWalletStore();

  // Функция разблокировки кошелька (ручной ввод ПИН-кода)
  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString());
      // Сохраняем фразу в сессию, чтобы при последующих F5 она подхватывалась автоматически
      sessionStorage.setItem("xcha_clear_mnemonic", clearMnemonic);

      const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
      const derivedAddress = await generateChiaAddressFromMnemonic(clearMnemonic, isTestnet);

      setWalletData(derivedAddress, clearMnemonic);
    } catch (error) {
      console.error("Ошибка при обработке входа:", error);
    }
  }, [setWalletData]);

  // Первичная проверка сессии при монтировании (включая обработку F5)
  useEffect(() => {
    const initAuth = async () => {
      const isAuth = localStorage.getItem("xcha_is_auth");
      const savedMnemonic = localStorage.getItem("xcha_mnemonic");

      if (isAuth !== "true" || !savedMnemonic) {
        window.location.href = "/";
        return;
      }

      const sessionExpires = sessionStorage.getItem("xcha_session_expires");
      const clearMnemonic = sessionStorage.getItem("xcha_clear_mnemonic");
      const now = Date.now();

      const isSessionValid = sessionExpires && now < parseInt(sessionExpires, 10);

      if (isSessionValid && walletAddress) {
        // Случай 1: Обычный переход по страницам, данные уже в Zustand
        setScreenLocked(false);
      } else if (isSessionValid && clearMnemonic) {
        try {
          // Случай 2: Был нажат F5. Сессия жива, фразу достаем из sessionStorage
          const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
          const derivedAddress = await generateChiaAddressFromMnemonic(clearMnemonic, isTestnet);
          
          // Восстанавливаем Zustand на лету
          setWalletData(derivedAddress, clearMnemonic);
          setScreenLocked(false);
        } catch (e) {
          lockWallet();
        }
      } else {
        // Случай 3: Время сессии вышло, либо данных в сессии нет — блокируем кошелек
        lockWallet();
        sessionStorage.removeItem("xcha_clear_mnemonic");
      }

      setVerifying(false);
    };

    initAuth();
  }, [walletAddress, lockWallet, setVerifying, setScreenLocked, setWalletData]);

  // Контроль бездействия (АФК таймер)
  useEffect(() => {
    if (isVerifying || isScreenLocked) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString());
      timeoutId = setTimeout(() => {
        lockWallet();
        sessionStorage.removeItem("xcha_clear_mnemonic"); // Стираем при автоблокировке
      }, INACTIVITY_TIMEOUT);
    };

    const events = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isVerifying, isScreenLocked, lockWallet]);

  return {
    walletAddress,
    decryptedPhrase,
    isVerifying,
    isScreenLocked,
    handleUnlockSuccess,
    lockWallet
  };
}
