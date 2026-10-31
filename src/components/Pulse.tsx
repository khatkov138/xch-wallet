'use client';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useWalletStatus } from "@/hooks/useWalletStatus";

export default function Pulse() {
  const { isPythonDown, isRpcDown, isNotSynced, nodeData } = useWalletStatus();

  // Проверяем состояние инициализации ноды (фейковые 100% при старте)
  const isInitializing = isNotSynced && nodeData && (
    nodeData.currentHeight === nodeData.targetHeight || 
    nodeData.progressPercent === "100.0000"
  );

  // Если всё работает идеально и нода синхронизирована — плашка полностью скрывается
  if (!isPythonDown && !isRpcDown && !isNotSynced) return null;

  // 🎯 РАСЧЕТ ПРИОРИТЕТОВ И СТИЛЕЙ ДЛЯ ОДНОЙ УМНОЙ ПЛАШКИ
  let title = "Технические работы";
  let description = "Проблема с сетью кошелька...";
  let borderColorClass = "border-zinc-900/50";
  let badgeColorClass = "text-zinc-400";
  let dotColorClass = "bg-zinc-500";
  let isLoaderActive = false;

  if (isPythonDown) {
    // 1. Критическая ошибка — упал питон
    title = "Сервер отключен";
    description = "Потеряно соединение с бэкендом API";
    borderColorClass = "border-red-500/20";
    badgeColorClass = "text-red-400";
    dotColorClass = "bg-red-500";
  } else if (isRpcDown) {
    // 2. Средняя ошибка — отвалился RPC ноды
    title = "Сбой RPC ноды";
    description = "Ошибка mTLS авторизации Full Node";
    borderColorClass = "border-red-500/20";
    badgeColorClass = "text-[#FF2E93]";
    dotColorClass = "bg-[#FF2E93]";
  } else if (isNotSynced) {
    // 3. Штатный режим синхронизации — включаем крутилку
    title = "Синхронизация сети";
    borderColorClass = "border-zinc-900/50";
    badgeColorClass = "text-amber-400";
    dotColorClass = "bg-amber-500";
    isLoaderActive = true;

    if (isInitializing) {
      description = "Инициализация ноды Chia и поиск пиров...";
    } else {
      description = `Догоняем блоки сети Chia... (${nodeData?.progressPercent ?? "0.00"}%)`;
    }
  }

  return (
    <div className="w-full h-[54px] mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* 🎯 ОДНА УМНАЯ КАРТОЧКА: Меняет цвета и контент на лету */}
      <div className={`flex items-center gap-3 p-3 bg-zinc-900/20 border rounded-[24px] h-full ${borderColorClass}`}>
        
        {/* Иконка / Вращающийся спиннер */}
        <div className="h-7 w-7 rounded-xl flex items-center justify-center bg-zinc-800 shrink-0">
          {isLoaderActive ? (
            <Loader2 size={14} className="animate-spin text-amber-400" />
          ) : (
            <ShieldAlert size={14} className={badgeColorClass} />
          )}
        </div>
        
        {/* Текстовая зона */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`h-1 w-1 rounded-full animate-pulse ${dotColorClass}`} />
            <p className="text-[10px] font-bold text-white uppercase tracking-wider leading-none">
              {title}
            </p>
          </div>
          <p className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest mt-1 leading-none truncate">
            {description}
          </p>
        </div>

      </div>
    </div>
  );
}
