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

export function useWalletFees(isEnabled: boolean = false, coinSpendsCount: number = 1) {
  return useQuery<RawFeesResponse, Error, CalculatedFees>({
    queryKey: FEES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/v1/node/fees');
      
      if (!res.ok) {
        throw new Error('Failed to fetch node fee estimates from proxy');
      }
      
      return res.json();
    },
    enabled: isEnabled,
    staleTime: 15000, 
    gcTime: 60000,
    select: (rawResponse) => {
      const estimates = rawResponse.estimates || [];
      const responseBlockCost = rawResponse.cost || 18000000;

      // 1. Динамический расчет реального веса транзакции в CLVM байтах
      const BASE_COST = 5000;
      const COST_PER_SPEND = 11000;
      const actualTxCost = BASE_COST + (coinSpendsCount * COST_PER_SPEND);

      // 2. Демасштабирование: переводим рейты из "за целый блок" в базовый коэффициент "Mojo за 1 Cost"
      const highRate = (estimates[0] || 0) / responseBlockCost;
      const mediumRate = (estimates[1] || 0) / responseBlockCost;
      const lowRate = (estimates[2] || 0) / responseBlockCost;

      // 3. Расчет адаптивной минимальной подушки безопасности (Mojo) под реальный вес
      const baseLow = 1 * actualTxCost;
      const baseMedium = 5 * actualTxCost;
      const baseHigh = 15 * actualTxCost;

      // 4. Финальное масштабирование рыночной комиссии под вес транзакции с защитой от просадок
      return {
        high: { 
          mojo: Math.max(Math.round(highRate * actualTxCost), baseHigh), 
          seconds: 60 
        },
        medium: { 
          mojo: Math.max(Math.round(mediumRate * actualTxCost), baseMedium), 
          seconds: 300 
        },
        low: { 
          mojo: Math.max(Math.round(lowRate * actualTxCost), baseLow), 
          seconds: 600 
        }
      };
    }
  });
}
