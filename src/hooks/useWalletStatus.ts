'use client';

import { useQuery, skipToken } from '@tanstack/react-query';
import { SocketPayload } from './useWalletWs';

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

// Плоский результирующий интерфейс хука для мемоизации
interface WalletStatusResult {
  isPythonDown: boolean;
  isRpcDown: boolean;
  isNotSynced: boolean;
  hasError: boolean;
  isLoading: boolean;
  nodeData: DerivedNodeStatus | null;
}

const QUERY_KEY = ['chiaNodeStatusCombined'];

export function useWalletStatus(): WalletStatusResult {
  // 🎯 ФИКС: Переносим ВСЮ деривацию и логику флагов в селектор.
  // Компонент будет ререндериться ТОЛЬКО тогда, когда изменится конечный результат вычислений!
  return useQuery<SocketPayload, Error, WalletStatusResult>({
    queryKey: QUERY_KEY,
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
    select: (rawPayload) => {
      // Этот блок выполняется только при реальном изменении rawPayload в кэше
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

     
      return {
        isPythonDown: false, // Флаги ошибок обрабатываются через status, вычисляем ниже по цепочке или оставляем дефолт
        isRpcDown: false,
        isNotSynced,
        hasError: false,
        isLoading: rawPayload === undefined,
        nodeData,
      };
    },
  }).data ?? {
    // Дефолтный стейт на случай, если данных вообще нет в кэше (например, до старта сокета)
    isPythonDown: false,
    isRpcDown: false,
    isNotSynced: false,
    hasError: false,
    isLoading: true,
    nodeData: null,
  };
}
