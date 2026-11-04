'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWalletSession } from "@/store/useWalletStore";

export interface SocketPayload {
  success: boolean;
  type?: 'NODE_RAW_UPDATE' | 'NODE_SYNCING_STATUS';
  error?: 'NODE_OFFLINE' | 'WAITING_FOR_NODE_CONNECT' | 'PYTHON_DOWN' | 'RPC_DOWN' | string;
  networkName?: string;
  blockchain_state?: any;
  syncData?: any;
  peersList?: any[];
  updatedAt: number;
}

export const QUERY_KEY = ['chiaNodeStatusCombined'];
export const WS_URL = 'ws://localhost:8000/ws/client';

export function useWalletWs() {
  const queryClient = useQueryClient();
  const network = useWalletSession((state) => state.network); // Считываем сеть из Zustand
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Эффект 1: Управление жизненным циклом WebSocket соединения (монтируется ОДИН раз)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setQueryError = (errorType: string) => {
      queryClient.setQueryData<SocketPayload | undefined>(QUERY_KEY, (old) => ({
        success: false,
        type: old?.type || 'NODE_RAW_UPDATE',
        error: errorType,
        updatedAt: Date.now(),
        networkName: old?.networkName,
        blockchain_state: old?.blockchain_state,
        syncData: old?.syncData,
        peersList: [], 
      }));
    };

    const connect = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }

      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('[✅ WALLET-WS] Соединение установлено');
        queryClient.setQueryData<SocketPayload | undefined>(QUERY_KEY, (old) => old ? { ...old, error: undefined } : undefined);
        
        // Сразу при открытии синхронизируем бэкенд с текущей сетью из Zustand
        const currentNetwork = useWalletSession.getState().network;
        wsRef.current?.send(JSON.stringify({ action: "SET_NETWORK", network: currentNetwork }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const payload: SocketPayload = JSON.parse(event.data);
          
          if (payload.error) {
            const translatedErr = (payload.error === 'NODE_OFFLINE' || payload.error === 'WAITING_FOR_NODE_CONNECT') ? 'RPC_DOWN' : payload.error;
            setQueryError(translatedErr);
            return;
          }

          if (payload.success) {
            if (payload.type === 'NODE_RAW_UPDATE' && payload.blockchain_state) {
              queryClient.setQueryData(QUERY_KEY, { ...payload, error: undefined, syncData: undefined });
            } else if (payload.type === 'NODE_SYNCING_STATUS' && payload.syncData) {
              queryClient.setQueryData<SocketPayload | undefined>(QUERY_KEY, (old) => ({
                ...payload,
                error: undefined,
                blockchain_state: old?.blockchain_state,
              }));
            }
          }
        } catch (err) { /* Игнорируем */ }
      };

      wsRef.current.onclose = (e) => {
        if (e.code !== 1000) setQueryError('PYTHON_DOWN');
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

  // 🎯 Эффект 2: Реактивная отправка события смены сети БЕЗ разрыва соединения
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log(`[🚀 WALLET-WS] Отправка команды переключения сети на бэкенд: ${network}`);
      wsRef.current.send(JSON.stringify({ action: "SET_NETWORK", network }));
    }
  }, [network]);

  return null;
}
