'use client';
import { useQuery } from '@tanstack/react-query';
import { handleApi } from "@/lib/utils";

interface PeerInfo { ip: string; port: number; trafficUpMb: string; trafficDownMb: string; }
interface FeeOption { mojo: number; seconds: number; } // Заменили mins на seconds

interface DynamicFees { low: FeeOption; medium: FeeOption; high: FeeOption; }

interface NodeShortStatus {
  network: string; isSynced: boolean; isSyncingMode: boolean; currentHeight: number;
  targetHeight: number; progressPercent: string; difficulty: number; networkSpaceTib: string;
  peakTime: string | null; totalPeers: number; peersList: PeerInfo[];
  dynamicFees?: DynamicFees; // Данные могут отсутствовать при ошибке RPC
}

export function useWalletStatus() {
  const { data, isError, error, isLoading } = useQuery({
    queryKey: ['chiaNodeStatusCombined'],
    queryFn: async () => {
      const res = await fetch("/api/v1/node/status");
      if (!res.ok) throw new Error(res.status === 502 ? 'PYTHON_DOWN' : 'RPC_DOWN');
      return handleApi<NodeShortStatus>(Promise.resolve(res));
    },
    refetchInterval: 10000, staleTime: 4000, retry: false,
  });

  const isPythonDown = isError && error?.message === 'PYTHON_DOWN';
  const isRpcDown = isError && error?.message === 'RPC_DOWN';
  
  return {
    isPythonDown, isRpcDown, isNotSynced: data ? !data.isSynced : false,
    hasError: isPythonDown || isRpcDown, isLoading,
    nodeData: data,
    dynamicFees: data?.dynamicFees // Просто прокидываем то, что вернул бэк
  };
}
