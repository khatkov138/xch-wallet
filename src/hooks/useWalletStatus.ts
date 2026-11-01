'use client';
import { useQuery } from '@tanstack/react-query';
import { handleApi } from "@/lib/utils";

interface PeerInfo {
  ip: string;
  port: number;
  trafficUpMb: string;
  trafficDownMb: string;
}

interface NodeShortStatus {
  network: string;
  isSynced: boolean;
  isSyncingMode: boolean;
  currentHeight: number;
  targetHeight: number;
  progressPercent: string;
  difficulty: number;
  networkSpaceTib: string;
  peakTime: string | null;
  totalPeers: number;
  peersList: PeerInfo[];
}

export function useWalletStatus() {
  const { data, isError, error, isLoading } = useQuery({
    queryKey: ['chiaNodeStatusCombined'],
    queryFn: async () => {
      try {
        const res = await fetch("/api/v1/node/status");
        
        if (!res.ok) {
          if (res.status === 502) {
            throw new Error('PYTHON_DOWN');
          }
          throw new Error('RPC_DOWN');
        }
        
        return handleApi<NodeShortStatus>(Promise.resolve(res));
      } catch (err: any) {
        if (err.message !== 'RPC_DOWN' && err.message !== 'PYTHON_DOWN') {
          throw new Error('PYTHON_DOWN');
        }
        throw err;
      }
    },
    refetchInterval: 10000,
    staleTime: 4000,
    retry: false,
  });

  // Распределяем флаги строго на основе ошибок выполнения запроса
  const isPythonDown = isError && error?.message === 'PYTHON_DOWN';
  const isRpcDown = isError && error?.message === 'RPC_DOWN';
  const isNotSynced = data ? data.isSynced === false : false;
  
  // Ошибка фиксируется только если запрос упал
  const hasError = isPythonDown || isRpcDown;

  return {
    isPythonDown,
    isRpcDown,
    isNotSynced,
    hasError,
    isLoading, // 🎯 Прокидываем статус загрузки в компонент
    nodeData: data,
  };
}
