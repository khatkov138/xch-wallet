'use client'

import { createStore } from 'zustand'
import { WalletLanguage, DEFAULT_LANGUAGE, isSupportedLanguage } from '@/config/i18n'

const isClient = typeof window !== 'undefined'

export type WalletCurrency = 'RUB' | 'USD'

// Структура настроек, которые шарятся с сервером через Cookies
export interface UserSettingsProps {
  network: 'mainnet' | 'testnet11'
  currency: WalletCurrency
  balanceDisplay: 'xch' | 'fiat'
  language: WalletLanguage
  isAuth: boolean // 🔐 Маркер авторизации для SSR
}

// Интерфейс стора: данные + экшены
export interface UserSettingsState extends UserSettingsProps {
  setNetwork: (network: 'mainnet' | 'testnet11') => void
  setCurrency: (currency: WalletCurrency) => void
  setBalanceDisplay: (display: 'xch' | 'fiat') => void
  setLanguage: (language: WalletLanguage) => void
  setIsAuth: (isAuth: boolean) => void
}

// Адаптер для точечной записи настроек в куки браузера
export const cookieStorageApi = {
  setItem: (name: string, value: string): void => {
    if (!isClient) return
    const expires = new Date()
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 год
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
  }
}

// 🏭 ОПТИМИЗИРОВАННАЯ ФАБРИКА СТОРА НАСТРОЕК
export const createUserSettingsStore = (storeCookies?: Array<{ name: string; value: string }>) => {
  
  // Безопасный поиск значения куки в переданном массиве
  const getVal = (name: string) => {
    if (!storeCookies || !Array.isArray(storeCookies)) return undefined
    return storeCookies.find(c => c.name === name)?.value
  }

  // Накатываем дефолты только если кук физически нет в массиве
  const initProps: UserSettingsProps = {
    network: getVal('xchia-network') === 'testnet11' ? 'testnet11' : 'mainnet',
    language: getVal('xchia-lang') && isSupportedLanguage(getVal('xchia-lang')!) ? (getVal('xchia-lang') as WalletLanguage) : DEFAULT_LANGUAGE,
    currency: getVal('xchia-currency') === 'USD' ? 'USD' : 'RUB',
    balanceDisplay: getVal('xchia-balance-display') === 'fiat' ? 'fiat' : 'xch',
    isAuth: getVal('xchia-is-auth') === 'true'
  }

  // Возвращаем чистый реактивный стор. Настройки сохраняются в куки строго при вызове экшенов.
  return createStore<UserSettingsState>()((set) => ({
    ...initProps,

    setNetwork: (network) => {
      cookieStorageApi.setItem('xchia-network', network)
      set({ network })
    },
    
    setCurrency: (currency) => {
      cookieStorageApi.setItem('xchia-currency', currency)
      set({ currency })
    },
    
    setBalanceDisplay: (balanceDisplay) => {
      cookieStorageApi.setItem('xchia-balance-display', balanceDisplay)
      set({ balanceDisplay })
    },
    
    setLanguage: (language) => {
      const nextCurrency: WalletCurrency = language === 'ru' ? 'RUB' : 'USD'
      
      cookieStorageApi.setItem('xchia-lang', language)
      cookieStorageApi.setItem('xchia-currency', nextCurrency) // Авто-синк валюты при смене языка
      
      set({ language, currency: nextCurrency })
    },
    
    setIsAuth: (isAuth) => {
      cookieStorageApi.setItem('xchia-is-auth', String(isAuth))
      set({ isAuth })
    }
  }))
}
