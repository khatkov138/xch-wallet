'use client'

import { useQuery } from "@tanstack/react-query"
import { handleApi } from "@/lib/utils"
import { useWalletAuth } from "@/hooks/useWalletAuth"

export interface IndexRecord { index: number; puzzle_hash: string; xch: string; mojo: string; coins: any[]; }
export interface MultiIndexBalanceData { total_xch: string; total_mojo: string; addresses: IndexRecord[]; }

export function useWalletBalance() {
  const { getUnhardenedPkHex } = useWalletAuth()
  const walletPublicKeyHex = getUnhardenedPkHex()

  const query = useQuery<MultiIndexBalanceData>({
    queryKey: ['walletBalance', walletPublicKeyHex],
    queryFn: () => handleApi<MultiIndexBalanceData>(fetch(`/api/wallet/balance?publicKeyHex=${walletPublicKeyHex}`)),
    enabled: !!walletPublicKeyHex,
    refetchInterval: 10000, // 10 сек авто-апдейт
    staleTime: 5000,
  })

  // Сразу готовим красиво отформатированные данные для презентации
  const realXCHStr = query.data?.total_xch ?? "0"
  const numericXCH = Number(realXCHStr)

  return {
    ...query,
    realXCHStr,
    numericXCH,
    addresses: query.data?.addresses ?? [],
  }
}
