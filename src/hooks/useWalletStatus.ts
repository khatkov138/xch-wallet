'use client';

import { useQuery, skipToken } from '@tanstack/react-query';
import { SocketPayload, QUERY_KEY} from './useWalletWs';

export interface DerivedNodeStatus {
  network: string;
  isSynced: boolean;
  isSyncingMode: boolean;
  isConnecting: boolean; // <-- НОВОЕ: Флаг поиска пиров
  currentHeight: number;
  targetHeight: number;
  progressPercent: string;
  difficulty: number;
  networkSpaceTib: string;
  peakTime: string | null;
  mempoolSize: number;
  peersList: any[];
  totalPeers: number;
}

interface WalletStatusResult {
  isPythonDown: boolean;
  isRpcDown: boolean;
  isNotSynced: boolean;
  isConnecting: boolean; // <-- НОВОЕ: Прокидываем наверх для UI
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
    select: (raw) => {
      const isPythonDown = raw?.error === 'PYTHON_DOWN';
      const isRpcDown = raw?.error === 'RPC_DOWN';
      const hasError = isPythonDown || isRpcDown;
      const peersList = raw?.peersList ?? [];
      const hasNoPeers = peersList.length === 0; // <-- Фиксируем отсутствие пиров
      
      let nodeData: DerivedNodeStatus | null = null;

      if (raw?.type === 'NODE_SYNCING_STATUS' && raw.syncData) {
        const sync = raw.syncData;
        const st = raw.blockchain_state;
        nodeData = {
          network: raw.networkName ?? 'unknown', isSynced: false, isSyncingMode: true, isConnecting: false,
          currentHeight: sync.progress, targetHeight: sync.target, progressPercent: sync.percent.toFixed(4),
          difficulty: st ? Number(st.difficulty ?? 0) : 0, networkSpaceTib: st ? String(st.space ?? '0') : '0',
          mempoolSize: st ? Number(st.mempool_size ?? 0) : 0, peakTime: null, peersList, totalPeers: peersList.length
        };
      } else if (raw?.blockchain_state) {
        const st = raw.blockchain_state;
        const sync = st.sync;
        const currentHeight = st.peak?.height ?? 0;
        
        // Переводим в состояние CONNECTING, если пиров 0, даже если нода отдает сырые структуры
        const isConnecting = hasNoPeers; 
        
        let targetHeight = currentHeight;
        let progressPercent = '100.0000';

        if (!sync.synced) {
          const tip = sync.sync_tip_height ?? 0;
          targetHeight = tip > 0 ? tip : currentHeight;
          
          // Если пиров нет, прогресс синка равен 0, так как мы даже не начали
          if (isConnecting) {
            progressPercent = '0.0000';
          } else {
            progressPercent = targetHeight > 0 ? ((currentHeight / targetHeight) * 100).toFixed(4) : '0.0000';
          }
        }

        const ts = st.peak?.timestamp;
        const peakTime = ts && ts > 0 ? new Date(ts * 1000).toISOString().replace('+00:00', 'Z') : null;

        nodeData = {
          network: raw.networkName ?? 'unknown', 
          // Если пиров нет, нода НЕ может считаться синхронизированной (стейт заморожен)
          isSynced: isConnecting ? false : !!sync.synced, 
          isSyncingMode: isConnecting ? false : !!sync.sync_mode,
          isConnecting,
          currentHeight, targetHeight, progressPercent, difficulty: Number(st.difficulty ?? 0),
          networkSpaceTib: String(st.space ?? '0'), mempoolSize: Number(st.mempool_size ?? 0),
          peakTime, peersList, totalPeers: peersList.length
        };
      }

      return {
        isPythonDown, 
        isRpcDown, 
        isNotSynced: nodeData ? !nodeData.isSynced : false, 
        isConnecting: nodeData ? nodeData.isConnecting : false, // <-- Отдаем наружу
        hasError,
        isLoading: !hasError && !(raw?.blockchain_state || raw?.syncData), 
        nodeData
      };
    },
  }).data ?? {
    isPythonDown: true, isRpcDown: false, isNotSynced: false, isConnecting: false, hasError: true, isLoading: false, nodeData: null
  };
}
