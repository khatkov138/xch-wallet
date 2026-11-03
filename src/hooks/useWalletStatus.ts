'use client';

import { useQuery, skipToken } from '@tanstack/react-query';

// --- ТИПЫ ДАННЫХ ---
export interface PeerInfo {
  ip: string;
  port: number;
  trafficUpMb: string;
  trafficDownMb: string;
}

export interface FeeOption {
  mojo: number;
  seconds: number;
}

export interface DynamicFees {
  low: FeeOption;
  medium: FeeOption;
  high: FeeOption;
}

export interface NodeShortStatus {
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
  dynamicFees?: DynamicFees;
}

const QUERY_KEY = ['chiaNodeStatusCombined'];

// --- РЕАКТИВНЫЙ ХУК-РАСЧЕТЧИК ---
export function useWalletStatus() {
  const { data, status, error } = useQuery<NodeShortStatus, Error>({
    queryKey: QUERY_KEY,
    // 🎯 ФИКС: Используем skipToken. Это легально отключает queryFn для TanStack Query v5+.
    // Кэш больше никогда автоматически не затрется дефолтными null/undefined значениями.
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Расчет флагов падения сети или ноды
  const isPythonDown = status === 'error' && error?.message === 'PYTHON_DOWN';
  const isRpcDown = status === 'error' && error?.message === 'RPC_DOWN';
  
  const isNotSynced = data ? !data.isSynced : false;
  const hasError = isPythonDown || isRpcDown;

  // 🔄 ИДЕАЛЬНЫЙ РАСЧЕТ ИНИЦИАЛИЗАЦИИ:
  // До тех пор, пока сокет-демон не прислал самый первый пакет (data === undefined) 
  // и при этом нет ошибок сети — мы находимся в состоянии первичной загрузки.
  const isLoading = data === undefined && status !== 'error';

  return {
    isPythonDown,
    isRpcDown,
    isNotSynced,
    hasError,
    isLoading,
    nodeData: data ?? null, 
    dynamicFees: data?.dynamicFees,
  };
}
