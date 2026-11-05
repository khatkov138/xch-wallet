'use client'

import { globalUserSettingsStore } from '@/providers/UserSettnigsProvider'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const isClient = typeof window !== 'undefined'
const dummyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const getSessionStorage = () => (isClient ? sessionStorage : dummyStorage)

interface WalletSessionStoreState {
  unhardenedPkHex: string
  isScreenLocked: boolean
  isVerifying: boolean
  noWalletMode: boolean 
  expiresAt: number | null
  lastActivityAt: number | null
  activeIndexes: string 
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  startSession: (pkHex: string, timeoutMs: number) => void
  updateActivity: (timeoutMs: number) => void
  setScreenLocked: (status: boolean) => void
  setVerifying: (status: boolean) => void
  setNoWalletMode: (status: boolean) => void 
  setActiveIndexes: (indexes: string) => void 
  endSession: () => void
}

export const useWalletSessionStore = create<WalletSessionStoreState>()(
  persist(
    (set, get) => ({
      unhardenedPkHex: '',
      isScreenLocked: true, 
      isVerifying: true,    
      noWalletMode: false, 
      expiresAt: null,
      lastActivityAt: null,
      activeIndexes: '', 
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      startSession: (pkHex, timeoutMs) => {
        const now = Date.now()
        set({
          unhardenedPkHex: pkHex,
          isScreenLocked: false,
          isVerifying: false,
          noWalletMode: false, 
          lastActivityAt: now,
          expiresAt: now + timeoutMs,
          activeIndexes: '' 
        })
      },

      updateActivity: (timeoutMs) => {
        if (!get().unhardenedPkHex) return
        const now = Date.now()
        set({
          lastActivityAt: now,
          expiresAt: now + timeoutMs
        })
      },

      setScreenLocked: (status) => set({ isScreenLocked: status }),
      setVerifying: (status) => set({ isVerifying: status }),
      setNoWalletMode: (status) => set({ noWalletMode: status }), 
      
      setActiveIndexes: (indexes) => set({ activeIndexes: indexes }), 
      
      endSession: () => set({
        unhardenedPkHex: '',
        isScreenLocked: true,
        isVerifying: false,
        noWalletMode: false, 
        expiresAt: null,
        lastActivityAt: null,
        activeIndexes: '' 
      })
    }),
    {
      name: 'xcha-active-session',
      storage: createJSONStorage(getSessionStorage), 
      onRehydrateStorage: (state) => () => state?.setHasHydrated(true)
    }
  )
)

// ⚡ НА ТИВНЫЙ РЕАКТИВНЫЙ УПРАВЛЕНЕЦ КУКАМИ СЕССИИ (ВНЕ ФАЗЫ РЕНДЕРА)
// На основе живого состояния сессии вкладки мы выставляем легкую куку для SSR Next.js 16
useWalletSessionStore.subscribe((state) => {
  if (!state._hasHydrated) return // Железно ждем, пока sessionStorage подгрузится во вкладке

  const currentIsAuth = globalUserSettingsStore?.getState().isAuth
  
  // Если у нас включен режим "нет кошелька" — кука должна быть false.
  // Во всех остальных случаях (AUTHORIZED или NEED_UNLOCK) — кошелек существует, кука должна быть true!
  const shouldBeAuth = !state.noWalletMode 

  if (currentIsAuth !== shouldBeAuth) {
    globalUserSettingsStore?.getState().setIsAuth(shouldBeAuth)
  }
})
