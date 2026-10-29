'use client'

import { useQuery } from "@tanstack/react-query"
import { useWalletPublicKey } from "@/hooks/useWalletPublicKey"

export interface IndexRecord { 
  index: number; 
  address: string;
  puzzle_hash: string; 
  balance_mojos: number; 
  balance_xch: number; 
  has_balance: boolean; 
  coins: any[];
}

export interface BackendResponse { 
  total_xch: string;       // 🔥 Исправлено под твой wallets.py
  total_mojo: string;      // 🔥 Исправлено под твой wallets.py
  addresses: IndexRecord[]; 
}

export function useWalletBalance(mnemonic: string = 'material harvest garage wish seed possible item solar zero pupil off saddle glass dial burden desk apology wrap ivory work need favorite tilt burden') {
  // 1. Автоматически вытаскиваем Master Public Key из мнемоники локально на фронте
  const { masterPkHex, isLoading: isKeyLoading } = useWalletPublicKey({ mnemonic })

  // 2. Запускаем TanStack Query с авто-рефетчем раз в 30 секунд
  const query = useQuery<BackendResponse>({
    queryKey: ['walletBalance', masterPkHex],
    queryFn: async () => {
      // 🔥 Исправлен урл под точный роут твоего wallets.py: /api/wallet/balance
      const response = await fetch(
        `http://localhost:8000/api/wallet/balance?publicKeyHex=${masterPkHex}&limit=200`
      );
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      return response.json();
    },
    // Запрос пойдет только тогда, когда ключ кошелька успешно сгенерирован в браузере
    enabled: !!masterPkHex, 
    refetchInterval: 30000, // Авто-апдейт каждые 30 секунд
    staleTime: 15000,       // Данные считаются свежими 15 секунд
  })

  // 🔥 Исправлено чтение полей из ответа бэкенда (извлекаем total_xch)
  const realXCHStr = query.data?.total_xch ?? "0"
  const numericXCH = Number(realXCHStr)

  return {
    ...query,
    realXCHStr,
    numericXCH,
    addresses: query.data?.addresses ?? [],
    isLoading: isKeyLoading || query.isLoading,
  }
}
