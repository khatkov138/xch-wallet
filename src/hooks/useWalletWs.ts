'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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

export interface SocketPayload {
  success: boolean;
  error?: 'NODE_OFFLINE' | 'WAITING_FOR_NODE_CONNECT' | string;
  data?: NodeShortStatus;
  updatedAt: number;
}

export const QUERY_KEY = ['chiaNodeStatusCombined'];
export const WS_URL = 'ws://localhost:8080/ws/client';

export function useWalletWs() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setQueryError = (errorType: 'PYTHON_DOWN' | 'RPC_DOWN') => {
      console.warn(`[🚨 WALLET-WS] Системная ошибка: ${errorType}`);
      const queryCache = queryClient.getQueryCache();
      const query = queryCache.find({ queryKey: QUERY_KEY });
      
      if (query) {
        query.setState({
          // 🧠 ФИКС: Сохраняем прошлый стейт данных, чтобы UI не падал в скелетон/загрузку,
          // а просто отображал ошибку поверх старых данных (stale-while-error)
          data: query.state.data, 
          error: new Error(errorType),
          status: 'error',
          errorUpdateCount: query.state.errorUpdateCount + 1,
        });
        queryCache.notify({ type: 'observerResultsUpdated', query });
      }
    };

    const connect = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('[✅ WALLET-WS] Соединение успешно установлено');
        const queryCache = queryClient.getQueryCache();
        const query = queryCache.find({ queryKey: QUERY_KEY });
        
        if (query) {
          // 🎉 ФИКС: Сбрасываем ошибку, оставляя кэш нетронутым. 
          // Поскольку data не затерта, UI мгновенно переключится в рабочий режим, избегая стадии loading
          query.setState({ 
            error: null, 
            status: 'success' 
          });
          queryCache.notify({ type: 'observerResultsUpdated', query });
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const payload: SocketPayload = JSON.parse(event.data);

          if (payload.success && payload.data) {
            queryClient.setQueryData(QUERY_KEY, payload.data);
          } else if (payload.error) {
            console.warn(`[⚠️ WALLET-WS] Бэкенд вернул ошибку ноды: ${payload.error}`);
            if (payload.error === 'NODE_OFFLINE' || payload.error === 'WAITING_FOR_NODE_CONNECT') {
              setQueryError('RPC_DOWN');
            }
          }
        } catch (err) {
          // Игнорируем мусор
        }
      };

      wsRef.current.onerror = () => {};

      wsRef.current.onclose = (event) => {
        if (event.code !== 1000) {
          setQueryError('PYTHON_DOWN');
        }
        
        if (wsRef.current) {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onerror = null;
          wsRef.current.onclose = null;
          wsRef.current = null;
        }
        
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 4000);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return null;
}
