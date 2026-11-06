'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface NodeNetworkState {
  success: boolean;
  type?: 'NODE_RAW_UPDATE' | 'NODE_SYNCING_STATUS';
  error?: 'NODE_OFFLINE' | 'WAITING_FOR_NODE_CONNECT' | 'RPC_DOWN' | string;
  networkName?: string;
  blockchain_state?: any;
  syncData?: any;
  peersList?: any[];
}

// Новая структура кэша под трансляцию всех сетей
export interface CombinedSocketPayload {
  networks: {
    mainnet: NodeNetworkState;
    testnet11: NodeNetworkState;
    [key: string]: NodeNetworkState;
  };
  updatedAt: number;
  globalError?: 'PYTHON_DOWN' | string;
}

export const QUERY_KEY = ['chiaNodeStatusCombined'];
export const WS_URL = 'ws://localhost:8000/ws/client';

export function useWalletWs() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setGlobalError = (errorType: string) => {
      queryClient.setQueryData<CombinedSocketPayload | undefined>(QUERY_KEY, (old) => ({
        networks: old?.networks || {
          mainnet: { success: false, error: errorType },
          testnet11: { success: false, error: errorType }
        },
        globalError: errorType,
        updatedAt: Date.now(),
      }));
    };

    const connect = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }

      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('[✅ WALLET-WS] Соединение установлено. Получаем пул всех сетей.');
        queryClient.setQueryData<CombinedSocketPayload | undefined>(QUERY_KEY, (old) => 
          old ? { ...old, globalError: undefined } : undefined
        );
      };

      wsRef.current.onmessage = (event) => {
        try {
          const payload: CombinedSocketPayload = JSON.parse(event.data);

          // Маппим внутренние статусы ошибок сетей в читаемый RPC_DOWN
          const processedNetworks = { ...payload.networks };
          Object.keys(processedNetworks).forEach((net) => {
            const err = processedNetworks[net].error;
            if (err === 'NODE_OFFLINE' || err === 'WAITING_FOR_NODE_CONNECT') {
              processedNetworks[net].error = 'RPC_DOWN';
            }
          });

          queryClient.setQueryData(QUERY_KEY, {
            networks: processedNetworks,
            updatedAt: payload.updatedAt,
            globalError: undefined
          });
        } catch (err) { /* Игнорируем */ }
      };

      wsRef.current.onclose = (e) => {
        if (e.code !== 1000) setGlobalError('PYTHON_DOWN');
        if (wsRef.current) {
          wsRef.current.onopen = wsRef.current.onmessage = wsRef.current.onerror = wsRef.current.onclose = null;
          wsRef.current = null;
        }
        if (!reconnectTimeoutRef.current) reconnectTimeoutRef.current = setTimeout(connect, 4000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [queryClient]);

  return null;
}
