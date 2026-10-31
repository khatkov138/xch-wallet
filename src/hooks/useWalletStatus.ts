'use client';
import { useQuery } from '@tanstack/react-query';
import { handleApi } from "@/lib/utils";

// 🎯 ДОБАВИЛИ ВСЕ ПОЛЯ ИЗ ТВОЕГО JSON СЮДА
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
  peersList: PeerInfo[]; // 🎯 Добавили строгий тип массива пиров в хук
}
export function useWalletStatus() {
  const { isError: isPythonDown } = useQuery({
    queryKey: ['pythonStatusCheck'],
    queryFn: async () => {
      const res = await fetch('/api/backend-status');
      if (!res.ok) throw new Error('Python API Offline');
      return res.json();
    },
    refetchInterval: 6000,
    retry: false,
  });

  const { data: nodeData, isError: isRpcDown } = useQuery<NodeShortStatus>({
    queryKey: ['chiaNodeStatus'],
    queryFn: () => handleApi<NodeShortStatus>(fetch("/api/node-status")),
    refetchInterval: 10000,
    staleTime: 4000,
    retry: false,
  });

  const isNotSynced = nodeData && nodeData.isSynced === false;
  const hasError = isPythonDown || isRpcDown || isNotSynced;

  let title = "Технические работы";
  let description = "Проблема с сетью кошелька...";

  if (isPythonDown) {
    title = "Сервер отключен";
    description = "Потеряно соединение с бэкендом API";
  } else if (isRpcDown) {
    title = "Сбой RPC";
    description = "Ошибка mTLS авторизации Full Node";
  } else if (isNotSynced) {
    title = "Синхронизация";
    description = `Догоняем блоки сети Chia... (${nodeData?.progressPercent ?? "0.00"}%)`;
  }

  return {
    isPythonDown,
    isRpcDown,
    isNotSynced,
    hasError,
    title,
    description,
    nodeData,
  };
}
