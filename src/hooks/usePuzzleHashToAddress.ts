'use client'

import { useWalletStatus } from "@/hooks/useWalletStatus"
import { puzzleHashToAddress } from "@/lib/utils/crypto"

/**
 * 🎯 УНИВЕРСАЛЬНЫЙ ХУК ДЛЯ АВТОМАТИЧЕСКОЙ КОНВЕРТАЦИИ PUZZLE HASH В РЕАЛЬНЫЙ АДРЕС
 * Сам следит за текущей сетью (Mainnet/Testnet) и кэширует результат.
 * 
 * @param puzzleHash Сырой хэш пазла (строка hex с 0x или без)
 * @returns Строка адреса формата xch1... или txch1...
 */
export function usePuzzleHashToAddress(puzzleHash: string | undefined | null): string {
  // 1. Один раз подписываемся на статус сети во всем приложении
  const { nodeData } = useWalletStatus()

  if (!puzzleHash) return ""

  // 2. Вычисляем текущий префикс
  const networkName = nodeData?.network || "mainnet"
  const currentPrefix = networkName.toLowerCase().includes("testnet") ? "txch" : "xch"

  // 3. Возвращаем готовый закодированный адрес
  return puzzleHashToAddress(puzzleHash, currentPrefix)
}
