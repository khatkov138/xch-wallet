'use client';

import { useQuery, skipToken } from '@tanstack/react-query';
import { SocketPayload, QUERY_KEY } from './useWalletWs';

export interface DerivedNodeStatus {
  network: string;
  isSynced: boolean;
  isSyncingMode: boolean;
  currentHeight: number;
  targetHeight: number;
  progressPercent: string;
  difficulty: number;
  networkSpaceTib: string;
  peakTime: string | null;
  mempoolSize: number;
}

interface WalletStatusResult {
  isPythonDown: boolean;
  isRpcDown: boolean;
  isNotSynced: boolean;
  hasError: boolean;
  isLoading: boolean;
  nodeData: DerivedNodeStatus | null;
}

export function useWalletStatus(): WalletStatusResult {
  return useQuery<SocketPayload, Error, WalletStatusResult>({
    queryKey: QUERY_KEY,
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
    select: (rawPayload) => {
      // 1. Извлекаем ошибки, которые useWalletWs.ts атомарно записал в кэш
      const isPythonDown = rawPayload?.error === 'PYTHON_DOWN';
      const isRpcDown = rawPayload?.error === 'RPC_DOWN';
      const hasError = isPythonDown || isRpcDown;

      let nodeData: DerivedNodeStatus | null = null;

      if (rawPayload?.blockchain_state) {
        const state = rawPayload.blockchain_state;
        const sync = state.sync;
        const peak = state.peak;

        const currentHeight = peak?.height ?? 0;
        let targetHeight = currentHeight;
        let progressPercent = '100.0000';

        if (!sync.synced) {
          const tip = sync.sync_tip_height ?? 0;
          targetHeight = tip > 0 ? tip : currentHeight;
          progressPercent = targetHeight > 0 
            ? ((currentHeight / targetHeight) * 100).toFixed(4) 
            : '0.0000';
        }

        const ts = peak?.timestamp;
        const peakTime = ts && ts > 0 
          ? new Date(ts * 1000).toISOString().replace('+00:00', 'Z') 
          : null;

        nodeData = {
          network: rawPayload.networkName ?? 'unknown',
          isSynced: !!sync.synced,
          isSyncingMode: !!sync.sync_mode || (!sync.synced && currentHeight < targetHeight),
          currentHeight,
          targetHeight,
          progressPercent,
          difficulty: Number(state.difficulty ?? 0),
          networkSpaceTib: String(state.space ?? '0'),
          mempoolSize: Number(state.mempool_size ?? 0),
          peakTime,
        };
      }

      const isNotSynced = nodeData ? !nodeData.isSynced : false;

      // 2. ЖЕСТКИЙ КОНТРОЛЬ LOADING: Загрузка идет только если нет ошибок И нет данных блокчейна
      const isLoading = !hasError && !rawPayload?.blockchain_state;

      return {
        isPythonDown,
        isRpcDown,
        isNotSynced,
        hasError,
        isLoading,
        nodeData,
      };
    },
  }).data ?? {
    // 3. ИНИЦИАЛИЗАЦИЯ ПРИ ХОЛОДНОМ СТАРТЕ (до первого ответа сокета):
    // Если сокет лежит изначально (ERR_CONNECTION_REFUSED), кэш будет undefined.
    // Вместо вечного лоадинга сразу выставляем оффлайн-стейт.
    isPythonDown: true, 
    isRpcDown: false,
    isNotSynced: false,
    hasError: true,
    isLoading: false, // Лоадинг заглушен
    nodeData: null,
  };
}
