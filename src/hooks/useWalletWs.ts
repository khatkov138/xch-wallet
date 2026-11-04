'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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

export interface ChiaSyncData {
  progress: number;
  target: number;
  percent: number;
}

export interface PeerInfo {
  ip: string;
  port: number;
  trafficUpMb: string;
  trafficDownMb: string;
}

export interface SocketPayload {
  success: boolean;
  type?: 'NODE_RAW_UPDATE' | 'NODE_SYNCING_STATUS';
  error?: 'NODE_OFFLINE' | 'WAITING_FOR_NODE_CONNECT' | 'PYTHON_DOWN' | 'RPC_DOWN' | string;
  networkName?: string;
  blockchain_state?: ChiaBlockchainState;
  syncData?: ChiaSyncData;
  peersList?: PeerInfo[];
  updatedAt: number;
}

export const QUERY_KEY = ['chiaNodeStatusCombined'];
export const WS_URL = 'ws://localhost:8000/ws/client';

export function useWalletWs() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setQueryError = (errorType: string) => {
      console.warn(`[🚨 WALLET-WS] Ошибка статуса: ${errorType}`);
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

  return null;
}
