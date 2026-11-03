'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Server } from 'lucide-react';

interface WalletBannerProps {
  isPythonDown: boolean;
  isRpcDown: boolean;
  isNotSynced: boolean;
  isBannerHidden: boolean;
  progressPercent: string;
  currentHeight: number;
  targetHeight: number;
}

const SyncingDescription = React.memo(function SyncingDescription({ 
  progress, 
  currentHeight, 
  targetHeight 
}: { 
  progress: string; 
  currentHeight: number; 
  targetHeight: number; 
}) {
  const isInitializing = currentHeight === targetHeight || progress === "100.0000";
  const formattedProgress = useMemo(() => parseFloat(progress).toFixed(2), [progress]);

  return (
    <span>
      {isInitializing
        ? "Синхронизируемся с блокчейном..."
        : `Синхронизируемся с блокчейном... (${formattedProgress}%)`}
    </span>
  );
});

export const WalletBanner = React.memo(function WalletBanner({
  isPythonDown,
  isRpcDown,
  isNotSynced,
  isBannerHidden,
  progressPercent,
  currentHeight,
  targetHeight
}: WalletBannerProps) {

  const config = useMemo(() => {
    if (isBannerHidden) return null;

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
    if (isNotSynced) {
      return {
        title: "Временные неполадки",
        borderColorClass: "border-zinc-900/60 bg-zinc-950/40 backdrop-blur-md hover:bg-zinc-900/40 hover:border-zinc-700/60",
        badgeColorClass: "text-yellow-400", 
        titleColorClass: "text-white",
        Icon: AlertTriangle,
        renderDynamicDesc: true
      };
    }
    return null;
  }, [isPythonDown, isRpcDown, isNotSynced, isBannerHidden]);

  // Если баннер скрыт принудительно или нет условий для его показа — не рендерим ничего
  if (isBannerHidden || !config) return null;

  return (
    <div className="w-full h-[54px] mb-2 relative select-none">
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
            {config.renderDynamicDesc ? (
              <SyncingDescription 
                progress={progressPercent} 
                currentHeight={currentHeight}
                targetHeight={targetHeight}
              />
            ) : (
              config.description
            )}
          </p>
        </div>
      </Link>
    </div>
  );
});
