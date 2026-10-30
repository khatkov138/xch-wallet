'use client'

import { useEffect, useRef } from 'react'
import { useWalletAuth } from './useWalletAuth'
import { useWalletSession } from '@/store/useWalletStore'

const THROTTLE_DELAY = 4000 

export function useIdleTimer() {
  const { updateSessionTimer } = useWalletAuth()
  const unhardenedPkHex = useWalletSession((state) => state.unhardenedPkHex)
  const lastSavedRef = useRef<number>(typeof window !== 'undefined' ? Date.now() : 0)

  useEffect(() => {
    if (!unhardenedPkHex) return

    // Обработчик обычных действий пользователя на странице
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastSavedRef.current < THROTTLE_DELAY) return

      lastSavedRef.current = now
      requestAnimationFrame(() => {
        updateSessionTimer()
      })
    }

    // Стандартные UI события на странице
    const pageEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    pageEvents.forEach(event => window.addEventListener(event, handleActivity, { passive: true }))

    // 🛡️ СИСТЕМНЫЕ СОБЫТИЯ: Обновляем сессию ТОЛЬКО при реальном возврате в приложение
    const handleWindowFocus = () => {
      // Продлеваем сессию только если вкладка видима пользователю
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return // Если вкладка скрылась, уходим в фон молча, сессию НЕ продлеваем!
      }
      
      lastSavedRef.current = Date.now()
      updateSessionTimer()
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleWindowFocus)

    return () => {
      pageEvents.forEach(event => window.removeEventListener(event, handleActivity))
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleWindowFocus)
    }
  }, [unhardenedPkHex, updateSessionTimer])
}
