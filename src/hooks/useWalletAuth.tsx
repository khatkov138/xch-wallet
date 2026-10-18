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

  // Функция разблокировки кошелька
  const handleUnlockSuccess = useCallback(async (clearMnemonic: string) => {
    try {
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString());

      const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
      
      // Генерируем адрес на клиенте
      const derivedAddress = await generateChiaAddressFromMnemonic(clearMnemonic, isTestnet);

      // Пишем данные в Zustand. Компоненты автоматически начнут поллинг баланса
      setWalletData(derivedAddress, clearMnemonic);

    } catch (error) {
      console.error("Ошибка при обработке входа:", error);
    }
  }, [setWalletData]);

  // Первичная проверка сессии при монтировании
  useEffect(() => {
    const isAuth = localStorage.getItem("xcha_is_auth");
    const savedMnemonic = localStorage.getItem("xcha_mnemonic");

    if (isAuth !== "true" || !savedMnemonic) {
      window.location.href = "/";
      return;
    }

    const sessionExpires = sessionStorage.getItem("xcha_session_expires");
    const now = Date.now();

    if (!sessionExpires || now > parseInt(sessionExpires, 10)) {
      lockWallet(); // Время вышло или обновили F5 — на замок
    } else {
      // Для безопасности при F5 (так как оперативка стерлась) требуем ПИН заново
      lockWallet();
    }

    setVerifying(false);
  }, [lockWallet, setVerifying]);

  // Контроль бездействия (АФК таймер)
  useEffect(() => {
    if (isVerifying || isScreenLocked) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      sessionStorage.setItem("xcha_session_expires", (Date.now() + INACTIVITY_TIMEOUT).toString());
      timeoutId = setTimeout(lockWallet, INACTIVITY_TIMEOUT);
    };

    const handleVisibility = () => { if (document.hidden) lockWallet(); };

    const events = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach(event => window.addEventListener(event, resetTimer));
    document.addEventListener("visibilitychange", handleVisibility);

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibility);
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
