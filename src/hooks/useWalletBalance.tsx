'use client'

import { useQuery } from "@tanstack/react-query"
import { useWalletSession } from "@/store/useWalletStore" // Подключаем нашу сессию из Zustand

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
  total_xch: string;
  total_mojo: string;
  addresses: IndexRecord[];
}

export function useWalletBalance() {
  // 1. Достаем публичный ключ прямо из Zustand-сессии (он там уже лежит после ПИН-кода)
  const { unhardenedPkHex } = useWalletSession()

  // 2. Запускаем TanStack Query с авто-рефетчем раз в 30 секунд
  const query = useQuery<BackendResponse>({
    // В queryKey передаем наш ключ из Zustand, чтобы при смене кошелька данные авто-перезапрашивались
    queryKey: ['walletBalance', unhardenedPkHex],
    queryFn: async () => {
      const response = await fetch(
        `http://localhost:8000/api/wallet/balance?publicKeyHex=${unhardenedPkHex}&limit=200`
      );
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      return response.json();
    },
    // Запрос пойдет ТОЛЬКО тогда, когда юзер авторизован и ключ есть в сессии
    enabled: !!unhardenedPkHex,
    refetchInterval: 30000, // Авто-апдейт каждые 30 секунд
    staleTime: 15000,       // Данные считаются свежими 15 секунд
  })

  // Извлекаем балансы из ответа бэкенда
  const realXCHStr = query.data?.total_xch ?? "0"
  const numericXCH = Number(realXCHStr)

  return {
    ...query,
    realXCHStr,
    numericXCH,
    addresses: query.data?.addresses ?? [],
    // Загрузка идет, пока TanStack Query тащит данные с бэка
    isLoading: query.isLoading,
  }
}
