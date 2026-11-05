'use client'

import { useMemo } from "react"

import { puzzleHashToAddress } from "@/lib/utils/crypto"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

/**
 * 🎯 УНИВЕРСАЛЬНЫЙ ХУК ДЛЯ АВТОМАТИЧЕСКОЙ КОНВЕРТАЦИИ PUZZLE HASH В РЕАЛЬНЫЙ АДРЕС
 * Берет значение сети из Zustand-стора для мгновенного и стабильного переключения префиксов.
 */
export function usePuzzleHashToAddress(puzzleHash: string | undefined | null): string {
  // Стабильный синхронный селектор сети из Zustand
  const network = useUserSettingsStore((state) => state.network)

  return useMemo(() => {
    if (!puzzleHash) return ""
    
    // Префикс вычисляется моментально на основе выбранной в UI сети
    const prefix = network === 'mainnet' ? "xch" : "txch"
    
    return puzzleHashToAddress(puzzleHash, prefix)
  }, [puzzleHash, network])
}
