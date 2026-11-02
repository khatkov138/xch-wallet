'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Server, ShieldAlert } from 'lucide-react';
import { useWalletStatus } from "@/hooks/useWalletStatus";

// 🎯 ШАГ 1: Изолируем реактивный текст. Теперь изменения процентов 
// ререндерят ТОЛЬКО эту строчку, не затрагивая DOM родительской плашки.
function SyncingDescription() {
  const { nodeData } = useWalletStatus();
  
  const isInitializing = nodeData && (
    nodeData.currentHeight === nodeData.targetHeight ||
    nodeData.progressPercent === "100.0000"
  );

  return (
    <span>
      {isInitializing
        ? "Синхронизируемся с блокчейном..."
        : `Синхронизируемся с блокчейном... (${nodeData?.progressPercent ?? "0.00"}%)`}
    </span>
  );
}

// 🎯 ШАГ 2: Главный каркас. Защищен с помощью React.memo.
export const Pulse = React.memo(function Pulse() {
  // Достаем только контролирующие стейт-машину флаги
  const { isPythonDown, isRpcDown, isNotSynced, hasError, isLoading, nodeData } = useWalletStatus();

  const isSkeleton = isLoading && !nodeData;
  const isHidden = nodeData?.isSynced === true && !hasError;

  const config = useMemo(() => {
    if (isSkeleton || isHidden) return null;

    // 🚨 КРИТИЧЕСКАЯ ОШИБКА: Сервер упал
    if (isPythonDown) {
      return {
        title: "Сервер отключен",
        description: "Потеряно соединение с бэкендом API",
        borderColorClass: "border-[#FF2E93]/20 bg-zinc-950/40 backdrop-blur-md hover:border-[#FF2E93]/40",
        badgeColorClass: "text-[#FF2E93]",
        titleColorClass: "text-[#FF2E93]",
        Icon: Server,
        renderDynamicDesc: false
      };
    }
      
    // 🚨 КРИТИЧЕСКАЯ ОШИБКА: Сбой RPC ноды
    if (isRpcDown) {
      return {
        title: "Сбой RPC ноды",
        description: "Ошибка mTLS авторизации Full Node",
        borderColorClass: "border-[#FF2E93]/20 bg-zinc-950/40 backdrop-blur-md hover:border-[#FF2E93]/40",
        badgeColorClass: "text-[#FF2E93]",
        titleColorClass: "text-[#FF2E93]",
        Icon: Server,
        renderDynamicDesc: false
      };
    }
      
    // ⚠️ ВАРНИНГ СЕТИ: Синхронизация
    if (isNotSynced) {
      return {
        title: "Временные неполадки",
        borderColorClass: "border-zinc-900/60 bg-zinc-950/40 backdrop-blur-md hover:bg-zinc-900/40 hover:border-zinc-700/60",
        badgeColorClass: "text-yellow-400", 
        titleColorClass: "text-white",
        Icon: AlertTriangle,
        renderDynamicDesc: true // Разрешаем реактивный рендер процентов внутри
      };
    }

    return null;
  }, [isPythonDown, isRpcDown, isNotSynced, isSkeleton, isHidden]);

  if (isHidden) return null;

  return (
    <div className="w-full h-[54px] mb-2 relative select-none">
      {isSkeleton ? (
        <div className="absolute inset-0 flex items-center gap-3 p-3 bg-zinc-950/40 border border-zinc-900/60 rounded-[24px] h-full animate-pulse backdrop-blur-md">
          <div className="h-7 w-7 rounded-xl bg-zinc-900/60 border border-zinc-850 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 bg-zinc-900 rounded-full w-24" />
            <div className="h-2 bg-zinc-900/60 rounded-full w-40" />
          </div>
        </div>
      ) : config ? (
        <Link
          href="/status"
          className={`absolute inset-0 flex items-center gap-3 p-3 border rounded-[24px] h-full transition-all duration-300 ease-in-out cursor-pointer active:scale-[0.99] ${config.borderColorClass}`}
        >
          <div className="h-7 w-7 rounded-xl flex items-center justify-center bg-zinc-900/40 border border-zinc-850 shrink-0 shadow-sm">
            <config.Icon size={13} className={config.badgeColorClass} />
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-wider leading-none transition-colors duration-300 ${config.titleColorClass}`}>
              {config.title}
            </p>
            <p className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest mt-1 leading-none truncate">
              {config.renderDynamicDesc ? <SyncingDescription /> : config.description}
            </p>
          </div>
        </Link>
      ) : null}
    </div>
  );
});

export default Pulse;
