'use client';

import { useQuery, skipToken } from '@tanstack/react-query';
import { CombinedSocketPayload, QUERY_KEY, NodeNetworkState } from './useWalletWs';

export interface DerivedNodeStatus {
  network: string;
  isSynced: boolean;
  isSyncingMode: boolean;
  isConnecting: boolean; // Флаг поиска пиров
  currentHeight: number;
  targetHeight: number;
  progressPercent: string;
  difficulty: number;
  networkSpaceTib: string;
  peakTime: string | number | null; 
  mempoolSize: number;
  peersList: any[];
  totalPeers: number;
  blockchain_state?: any; // Сырой объект для карточек
  updatedAt: number; // Персональное время обновления сети
}

export interface SingleNodeStatusResult {
  isRpcDown: boolean;
  isNotSynced: boolean;
  isConnecting: boolean;
  hasError: boolean;
  isLoading: boolean;
  nodeData: DerivedNodeStatus | null;
}

interface NodesStatusResult {
  isPythonDown: boolean;
  networks: {
    mainnet: SingleNodeStatusResult;
    testnet11: SingleNodeStatusResult;
    [key: string]: SingleNodeStatusResult;
  };
}

const createInitialNodeState = (): SingleNodeStatusResult => ({
  isRpcDown: false,
  isNotSynced: false,
  isConnecting: false,
  hasError: false,
  isLoading: true,
  nodeData: null,
});

export function useNodesStatus(): NodesStatusResult {
  return useQuery<CombinedSocketPayload, Error, NodesStatusResult>({
    queryKey: QUERY_KEY,
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
    select: (raw) => {
      const isPythonDown = raw?.globalError === 'PYTHON_DOWN';
      
      const networksResult: Record<string, SingleNodeStatusResult> = {
        mainnet: createInitialNodeState(),
        testnet11: createInitialNodeState(),
      };

      if (raw?.networks) {
        Object.keys(raw.networks).forEach((netName) => {
          const netRaw: NodeNetworkState = raw.networks[netName];
          const isRpcDown = netRaw.error === 'RPC_DOWN';
          const hasError = isRpcDown;
          const peersList = netRaw.peersList ?? [];
          const hasNoPeers = peersList.length === 0;
          
          const st = netRaw.blockchain_state;

          // 🚀 КЛЮЧЕВОЙ ФИКС ХУКА: Вытаскиваем персональный updatedAt конкретной сети из сокета
          // Если его нет (до первого пуша), берем глобальный raw.updatedAt или текущее время
          const nodeSpecificUpdatedAt = (netRaw as any).updatedAt ?? raw.updatedAt ?? Date.now();

          let nodeData: DerivedNodeStatus | null = null;

          if (netRaw.type === 'NODE_SYNCING_STATUS' && netRaw.syncData) {
            const sync = netRaw.syncData;
            nodeData = {
              network: netRaw.networkName ?? netName, isSynced: false, isSyncingMode: true, isConnecting: false,
              currentHeight: sync.progress, targetHeight: sync.target, progressPercent: sync.percent.toFixed(4),
              difficulty: st ? Number(st.difficulty ?? 0) : 0, networkSpaceTib: st ? String(st.space ?? '0') : '0',
              mempoolSize: st ? Number(st.mempool_size ?? 0) : 0, peakTime: nodeSpecificUpdatedAt, 
              peersList, totalPeers: peersList.length,
              blockchain_state: st,
              updatedAt: nodeSpecificUpdatedAt // Прокидываем в UI карточки
            };
          } else if (st) {
            const sync = st.sync || { synced: true, sync_mode: false };
            const currentHeight = st.peak?.height ?? 0;
            const isConnecting = hasNoPeers;
            
            let targetHeight = currentHeight;
            let progressPercent = '100.0000';

            if (!sync.synced) {
              const tip = sync.sync_tip_height ?? 0;
              targetHeight = tip > 0 ? tip : currentHeight;
              
              if (isConnecting) {
                progressPercent = '0.0000';
              } else {
                progressPercent = targetHeight > 0 ? ((currentHeight / targetHeight) * 100).toFixed(4) : '0.0000';
              }
            }

            nodeData = {
              network: netRaw.networkName ?? netName,
              isSynced: isConnecting ? false : !!sync.synced,
              isSyncingMode: isConnecting ? false : !!sync.sync_mode,
              isConnecting,
              currentHeight, targetHeight, progressPercent, difficulty: Number(st.difficulty ?? 0),
              networkSpaceTib: String(st.space ?? '0'), mempoolSize: Number(st.mempool_size ?? 0),
              peakTime: nodeSpecificUpdatedAt, 
              peersList, totalPeers: peersList.length,
              blockchain_state: st,
              updatedAt: nodeSpecificUpdatedAt // Прокидываем в UI карточки
            };
          }

          networksResult[netName] = {
            isRpcDown,
            isNotSynced: nodeData ? !nodeData.isSynced : false,
            isConnecting: nodeData ? nodeData.isConnecting : false,
            hasError,
            isLoading: !hasError && !netRaw.blockchain_state && !netRaw.syncData,
            nodeData,
          };
        });
      }

      if (isPythonDown) {
        Object.keys(networksResult).forEach((net) => {
          networksResult[net].hasError = true;
        });
      }

      return {
        isPythonDown,
        networks: networksResult as any,
      };
    },
  }).data ?? {
    isPythonDown: true,
    networks: {
      mainnet: { isRpcDown: false, isNotSynced: false, isConnecting: false, hasError: true, isLoading: false, nodeData: null },
      testnet11: { isRpcDown: false, isNotSynced: false, isConnecting: false, hasError: true, isLoading: false, nodeData: null },
    },
  };
}
