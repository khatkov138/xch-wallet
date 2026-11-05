"use client"

import { createStore } from "zustand"
import { persist, createJSONStorage, StateStorage } from "zustand/middleware"
import { getCookie, setCookie, deleteCookie } from 'cookies-next'
import { WalletLanguage, DEFAULT_LANGUAGE } from '@/config/i18n'

export type WalletCurrency = 'RUB' | 'USD'

// Структура настроек кошелька
export interface UserSettingsProps {
  network: 'mainnet' | 'testnet11'
  currency: WalletCurrency
  balanceDisplay: 'xch' | 'fiat'
  language: WalletLanguage
  isAuth: boolean
}

// Интерфейс стора: данные + экшены
export interface UserSettingsState extends UserSettingsProps {
  setNetwork: (network: 'mainnet' | 'testnet11') => void
  setCurrency: (currency: WalletCurrency) => void
  setBalanceDisplay: (display: 'xch' | 'fiat') => void
  setLanguage: (language: WalletLanguage) => void
  setIsAuth: (isAuth: boolean) => void
}

// 🌐 Чистый куки-адаптер один в один как в твоем примере
const cookieStorage: StateStorage = {
  getItem: (name) => (getCookie(name) as string) ?? null,
  setItem: (name, value) => setCookie(name, value, {
    maxAge: 60 * 60 * 24 * 365, // 1 год
    path: '/',
    sameSite: 'lax'
  }),
  removeItem: (name) => deleteCookie(name),
}

// 🏭 ЭТАЛОННАЯ ФАБРИКА СТОРА КОШЕЛЬКА
export const createUserSettingsStore = (initProps: Partial<UserSettingsProps>) => {
  return createStore<UserSettingsState>()(
    persist(
      (set) => ({
        // Базовые фолбеки
        network: initProps.network || 'mainnet',
        language: initProps.language || DEFAULT_LANGUAGE,
        currency: initProps.currency || (initProps.language === 'ru' ? 'RUB' : 'USD'),
        balanceDisplay: initProps.balanceDisplay || 'xch',
        isAuth: initProps.isAuth ?? false,

        // Кристально чистые экшены
        setNetwork: (network) => set({ network }),
        setCurrency: (currency) => set({ currency }),
        setBalanceDisplay: (balanceDisplay) => set({ balanceDisplay }),
        setLanguage: (language) => set({ language, currency: language === 'ru' ? 'RUB' : 'USD' }),
        setIsAuth: (isAuth) => set({ isAuth })
      }),
      {
        name: 'xchia-user-settings', // Имя единой куки
        storage: createJSONStorage(() => cookieStorage),
        skipHydration: true, // Исключаем конфликты гидратации React 19
        partialize: (state) => ({
          network: state.network,
          language: state.language,
          currency: state.currency,
          balanceDisplay: state.balanceDisplay,
          isAuth: state.isAuth
        }),
      }
    )
  )
}
