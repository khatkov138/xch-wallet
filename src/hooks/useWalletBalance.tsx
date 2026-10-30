'use client'

import { useQuery } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore"

export function useWalletBalance() {
  const unhardenedPkHex = useWalletSession((state: any) => state.unhardenedPkHex)
  const activeIndexes = useWalletSession((state: any) => state.activeIndexes)

  // Добавляем <any>, чтобы TypeScript понимал динамическую структуру кэша дашборда
  const query = useQuery<any>({
    queryKey: ["wallet-dashboard", unhardenedPkHex, activeIndexes],
    queryFn: () => { return null as any },
    enabled: false,
  })

  const realXCHStr = query.data?.balance?.total_xch ?? "0.0000"
  const numericXCH = Number(realXCHStr)

  return {
    realXCHStr,
    numericXCH,
    addresses: query.data?.balance?.addresses ?? [], 
    error: query.error,
    isFetching: query.isFetching,
    isLoading: query.isLoading || !query.data,
    refetch: query.refetch,
  }
}
