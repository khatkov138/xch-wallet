'use client';

import { useWalletSession } from '@/store/useWalletStore';
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

// Строгое соответствие типизации ответа нашего бэкенда
interface RawFeesResponse {
  success: boolean;
  network: string;
  cost: number;
  tariffs: {
    high: { fee_mojos: number; seconds: number[]; raw_estimate: number };
    medium: { fee_mojos: number; seconds: number[]; raw_estimate: number };
    low: { fee_mojos: number; seconds: number[]; raw_estimate: number };
  };
}

export function useWalletFees(isEnabled: boolean = false, coinSpendsCount: number = 1) {
  const network = useWalletSession((state) => state.network);
  const FEES_QUERY_KEY = ['chiaNodeFeesEstimate', network];

  return useQuery<RawFeesResponse, Error, CalculatedFees>({
    queryKey: FEES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(`/api/v1/node/fees?network=${network}`);

      if (!res.ok) {
        throw new Error('Служба оценки комиссий недоступна. Ошибка прокси-сервера.');
      }

      const data = await res.json();
      
      // Жесткая валидация: если бэкенд лежит или вернул ошибку, падаем сразу
      if (!data || !data.success || !data.tariffs) {
        throw new Error(data?.detail || 'Некорректный ответ от ноды Chia.');
      }

      return data;
    },
    enabled: isEnabled,
    staleTime: 15000,
    gcTime: 60000,
    select: (rawResponse) => {
      const { tariffs, cost: responseBlockCost } = rawResponse;

      // Проверка структуры массивов времени. Если бэкенд прислал битые данные — не подставляем своё, а аварийно падаем.
      if (
        !Array.isArray(tariffs.high.seconds) || tariffs.high.seconds.length < 3 ||
        !Array.isArray(tariffs.medium.seconds) || tariffs.medium.seconds.length < 3 ||
        !Array.isArray(tariffs.low.seconds) || tariffs.low.seconds.length < 3
      ) {
        throw new Error('Критическая ошибка валидации данных: структура таймингов сети нарушена.');
      }

      // 1. Точный расчет CLVM-веса под транзакцию XCHia
      const CLVM_BASE_TX_COST = 5000;       
      const CLVM_COST_PER_INPUT = 11000;    
      const CLVM_COST_PER_OUTPUT = 1800000; 
      const CLVM_COST_AGG_SIG = 1200000;    

      // 1 инпут (coinSpendsCount) + 2 аутпута (получатель + сдача) + подпись
      const actualTxCost =
        CLVM_BASE_TX_COST +
        (coinSpendsCount * CLVM_COST_PER_INPUT) +
        (2 * CLVM_COST_PER_OUTPUT) +
        CLVM_COST_AGG_SIG;

      const costScaleFactor = actualTxCost / responseBlockCost;

      // Масштабируем готовую комиссию бэкенда под реальный cost
      const scaleFee = (backendFeeMojos: number) => {
        return Math.round(backendFeeMojos * costScaleFactor);
      };

      // 2. Возвращаем чистые данные, строго забирая тайминги по индексам из единого массива
      return {
        high: {
          mojo: scaleFee(tariffs.high.fee_mojos),
          seconds: tariffs.high.seconds[0]
        },
        medium: {
          mojo: scaleFee(tariffs.medium.fee_mojos),
          seconds: tariffs.medium.seconds[1]
        },
        low: {
          mojo: scaleFee(tariffs.low.fee_mojos),
          seconds: tariffs.low.seconds[2]
        }
      };
    }
  });
}
