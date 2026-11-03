'use client';

import { useQuery } from '@tanstack/react-query';

export interface FeeOption {
  mojo: number;
  seconds: number;
}

export interface CalculatedFees {
  high: FeeOption;
  medium: FeeOption;
  low: FeeOption;
}

interface RawFeesResponse {
  success: boolean;
  estimates: number[];
  cost: number;
}

const FEES_QUERY_KEY = ['chiaNodeFeesEstimate'];

export function useWalletFees(isEnabled: boolean = false) {
  return useQuery<RawFeesResponse, Error, CalculatedFees>({
    queryKey: FEES_QUERY_KEY,
    queryFn: async () => {
      // Изуем относительный путь через Next.js Route-Proxy
      const res = await fetch('/api/v1/node/fees');
      
      if (!res.ok) {
        throw new Error('Failed to fetch node fee estimates from proxy');
      }
      
      return res.json();
    },
    // Запрос пойдет строго когда модалка/форма открыта
    enabled: isEnabled,
    // Кэшируем на 15 секунд, чтобы не спамить ноду при перекликах в UI
    staleTime: 15000, 
    gcTime: 60000,
    select: (rawResponse) => {
      const estimates = rawResponse.estimates || [];
      const txCost = rawResponse.cost || 18000000;

      // Гарантированные безопасные пороги (mojo на единицу cost)
      const baseLow = 1 * txCost;
      const baseMedium = 5 * txCost;
      const baseHigh = 15 * txCost;

      return {
        high: { 
          mojo: Math.max(Number(estimates[0] || 0), baseHigh), 
          seconds: 60 
        },
        medium: { 
          mojo: Math.max(Number(estimates[1] || 0), baseMedium), 
          seconds: 300 
        },
        low: { 
          mojo: Math.max(Number(estimates[2] || 0), baseLow), 
          seconds: 600 
        }
      };
    }
  });
}
