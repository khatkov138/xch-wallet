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

// Изменено: Строгое соответствие новому JSON с бэкенда
interface RawFeesResponse {
  success: boolean;
  cost: number;
  tariffs: {
    high: { raw_estimate: number; seconds: number };
    medium: { raw_estimate: number; seconds: number };
    low: { raw_estimate: number; seconds: number };
  };
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
      // Защита на случай пустых данных
      const tariffs = rawResponse.tariffs || {
        high: { raw_estimate: 0, seconds: 60 },
        medium: { raw_estimate: 0, seconds: 300 },
        low: { raw_estimate: 0, seconds: 600 }
      };
      const responseBlockCost = rawResponse.cost || 18000000;

      // 1. Честный расчет реального CLVM-веса транзакции Chia (Инпуты, аутпуты и подписи)
      const CLVM_BASE_TX_COST = 5000;       
      const CLVM_COST_PER_INPUT = 11000;    
      const CLVM_COST_PER_OUTPUT = 1800000; 
      const CLVM_COST_AGG_SIG = 1200000;    

      const actualTxCost =
        CLVM_BASE_TX_COST +
        (coinSpendsCount * CLVM_COST_PER_INPUT) +
        (2 * CLVM_COST_PER_OUTPUT) +
        CLVM_COST_AGG_SIG;

      // 2. Универсальный внутренний хелпер маппинга без хардкода секунд
      const processTariff = (rawEstimate: number, baseMultiplier: number, seconds: number) => {
        const rate = (rawEstimate || 0) / responseBlockCost;
        const basePadding = baseMultiplier * actualTxCost;
        return {
          mojo: Math.max(Math.round(rate * actualTxCost), basePadding),
          seconds // Секунды прокидываются напрямую из ответа бэкенда
        };
      };

      // 3. Расчет тарифов с адаптивной подушкой безопасности
      return {
        high: processTariff(tariffs.high.raw_estimate, 15, tariffs.high.seconds),
        medium: processTariff(tariffs.medium.raw_estimate, 5, tariffs.medium.seconds),
        low: processTariff(tariffs.low.raw_estimate, 1, tariffs.low.seconds)
      };
    }
  });
}
