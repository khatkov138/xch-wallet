'use client'

import { createStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { WalletLanguage } from '@/config/i18n'

const isClient = typeof window !== 'undefined'
const dummyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const getLocalStorage = () => (isClient ? localStorage : dummyStorage)

export type WalletCurrency = 'RUB' | 'USD'

// Структура чистых настроек, которые шарятся с сервером через Cookies
export interface UserSettingsProps {
  network: 'mainnet' | 'testnet11'
  currency: WalletCurrency
  balanceDisplay: 'xch' | 'fiat'
  language: WalletLanguage
  isAuth: boolean // 🔐 Твой легкий маркер для мгновенного рендера SSR
}

// Интерфейс стора: данные + экшены
export interface UserSettingsState extends UserSettingsProps {
  setNetwork: (network: 'mainnet' | 'testnet11') => void
  setCurrency: (currency: WalletCurrency) => void
  setBalanceDisplay: (display: 'xch' | 'fiat') => void
  setLanguage: (language: WalletLanguage) => void
  setIsAuth: (isAuth: boolean) => void // Экшен переключения статуса авторизации
}

// Синхронный клиентский адаптер для управления куками интерфейса
export const cookieStorageApi = {
  setItem: (name: string, value: string): void => {
    if (!isClient) return
    const expires = new Date()
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 год
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
  }
}

// 🏭 ФАБРИКА СТОРА НАСТРОЕК
export const createUserSettingsStore = (initProps: UserSettingsProps) => {
  return createStore<UserSettingsState>()(
    persist(
      (set) => ({
        ...initProps, // Вливаем готовые данные (network, language, isAuth) с сервера сразу

        setNetwork: (network) => set({ network }),
        setCurrency: (currency) => set({ currency }),
        setBalanceDisplay: (balanceDisplay) => set({ balanceDisplay }),
        
        setLanguage: (language) => {
          cookieStorageApi.setItem('xchia-lang', language)
          set({ language, currency: language === 'ru' ? 'RUB' : 'USD' })
        },
        
        setIsAuth: (isAuth) => {
          // Мгновенно синхронизируем легкую куку для прокси и SSR следующего запроса
          cookieStorageApi.setItem('xchia-is-auth', String(isAuth))
          set({ isAuth })
        }
      }),
      {
        name: 'xchia-user-settings',
        storage: createJSONStorage(getLocalStorage),
        
        // ⚡ ПРОСТО И ЛАКОНИЧНО: Закидываем ВСЕ критические поля в partialize,
        // чтобы localStorage на клиенте идеально склеивался с серверными куками, 
        // убирая любые undefined и давая моментальный старт дашборда!
        partialize: (state) => ({
          network: state.network,
          currency: state.currency,
          balanceDisplay: state.balanceDisplay,
          language: state.language,
          isAuth: state.isAuth
        }),
      }
    )
  )
}
