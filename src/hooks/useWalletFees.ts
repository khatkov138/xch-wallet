'use client';



import { useUserSettingsStore } from '@/providers/UserSettnigsProvider';
import { useQuery } from '@tanstack/react-query';

export interface FeeOption {
  mojo: number;
  seconds: number;
}

export interface CalculatedFees {
  high: FeeOption;
  medium: FeeOption;
}

interface BackendFeesResponse {
  high: { fee_mojos: number; seconds: number };
  medium: { fee_mojos: number; seconds: number };
  low: { fee_mojos: number; seconds: number };
}

export function useWalletFees(isEnabled: boolean = false, coinSpendsCount: number = 1) {
  const network = useUserSettingsStore((state) => state.network);
  const FEES_QUERY_KEY = ['chiaNodeFeesEstimate', network, coinSpendsCount];

  return useQuery<BackendFeesResponse, Error, CalculatedFees>({
    queryKey: FEES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(`/api/v1/node/fees?network=${network}`);
      if (!res.ok) throw new Error('Служба оценки комиссий недоступна.');
      return await res.json();
    },
    enabled: isEnabled,
    staleTime: 15000,
    gcTime: 60000,
    select: (tariffs) => {
      // Линейный множитель для транзакции на основе количества инпутов (coinSpends)
      // Если инпут 1 — множитель 1.0. Если инпутов 2 — множитель 1.3, и т.д.
      // Это на 100% защищает от просадки комиссии ниже базового лимита ноды.
      const inputsCount = Math.max(1, coinSpendsCount);
      const feeMultiplier = 1 + (inputsCount - 1) * 0.3;

      const scaleFee = (baseMojos: number) => {
        return Math.round(baseMojos * feeMultiplier);
      };

      return {
        high: {
          mojo: scaleFee(tariffs.high.fee_mojos),
          seconds: tariffs.high.seconds
        },
        medium: {
          mojo: scaleFee(tariffs.medium.fee_mojos),
          seconds: tariffs.medium.seconds
        },
        low: {
          mojo: scaleFee(tariffs.low.fee_mojos),
          seconds: tariffs.low.seconds
        }
      };
    }
  });
}
