'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Внутренние интерфейсы официального сырого ответа Chia Full Node
export interface ChiaBlockPeak {
  height: number;
  timestamp: number;
  header_hash: string;
  weight: string;
}

export interface ChiaSyncState {
  sync_mode: boolean;
  sync_progress_height: number;
  sync_tip_height: number;
  synced: boolean;
}

export interface ChiaBlockchainState {
  difficulty: number;
  mempool_size: number;
  space: string;
  sub_slot_iters: number;
  sync: ChiaSyncState;
  peak: ChiaBlockPeak | null;
}

// Новый формат пакета транзитного WS-сервера + наши внутренние флаги ошибок для кэша
export interface SocketPayload {
  success: boolean;
  type?: 'NODE_RAW_UPDATE';
  error?: 'NODE_OFFLINE' | 'WAITING_FOR_NODE_CONNECT' | 'PYTHON_DOWN' | 'RPC_DOWN' | string;
  networkName?: string;
  blockchain_state?: ChiaBlockchainState;
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

    // Паттерн stale-while-error: пишем ошибку прямо в структуру данных, сохраняя старый блокчейн стейт
    const setQueryError = (errorType: 'PYTHON_DOWN' | 'RPC_DOWN') => {
      console.warn(`[🚨 WALLET-WS] Системная ошибка: ${errorType}`);
      
      queryClient.setQueryData<SocketPayload | undefined>(QUERY_KEY, (oldData) => {
        return {
          success: false,
          type: 'NODE_RAW_UPDATE',
          error: errorType,
          updatedAt: Date.now(),
          // Сохраняем старые данные ноды, если они были, предотвращая Layout Shift
          networkName: oldData?.networkName,
          blockchain_state: oldData?.blockchain_state,
        };
      });
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
        // При успешном коннекте очищаем ошибку в кэше, если данных ещё нет — селектор сам поймет статус загрузки
        queryClient.setQueryData<SocketPayload | undefined>(QUERY_KEY, (oldData) => {
          if (!oldData) return undefined;
          return {
            ...oldData,
            error: undefined // Сбрасываем ошибку
          };
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const payload: SocketPayload = JSON.parse(event.data);

          // Проверяем наличие сырого блокчейн-стейта
          if (payload.success && payload.blockchain_state) {
            // Пишем сырой payload атомарно "как есть" прямо в кэш TanStack
            queryClient.setQueryData(QUERY_KEY, payload);
          } else if (payload.error) {
            console.warn(`[⚠️ WALLET-WS] Бэкенд вернул ошибку ноды: ${payload.error}`);
            if (payload.error === 'NODE_OFFLINE' || payload.error === 'WAITING_FOR_NODE_CONNECT') {
              setQueryError('RPC_DOWN');
            }
          }
        } catch (err) {
          // Игнорируем мусорные пакеты парсинга
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
