'use client';

import { useWalletPublicKey } from '@/hooks/useWalletPublicKey';
import { useState } from 'react';

// Описываем структуру ответа от нашего Python FastAPI сервера
interface BackendAddressItem {
  index: number;
  address: string;
  puzzle_hash: string;
  balance_mojos: number;
  balance_xch: number;
  has_balance: boolean;
}

interface BackendResponse {
  success: boolean;
  total_balance_mojos: number;
  total_balance_xch: number;
  addresses: BackendAddressItem[];
}

export default function ChiaWalletTestPage() {
  const [mnemonicInput, setMnemonicInput] = useState(
    'material harvest garage wish seed possible item solar zero pupil off saddle glass dial burden desk apology wrap ivory work need favorite tilt burden'
  );
  const [limit, setLimit] = useState(200); // Задаем лимит сканирования (например, 20 или 200 адресов)

  // Данные с сервера и состояния загрузки
  const [backendData, setBackendData] = useState<BackendResponse | null>(null);
  const [isFetchLoading, setIsFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 1. Используем наш новый чистейший хук (получаем только Master Public Key)
  const { masterPkHex, isLoading: isHookLoading, error: hookError } = useWalletPublicKey({
    mnemonic: mnemonicInput,
  });

  // 2. Функция запроса к вашему питоновскому FastAPI серверу
  const handleScanWallet = async () => {
    if (!masterPkHex) return;

    setIsFetchLoading(true);
    setFetchError(null);

    try {
      // Адрес вашего FastAPI эндпоинта
      const response = await fetch(
        `http://localhost:8000/api/wallet/balance?publicKeyHex=${masterPkHex}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data: BackendResponse = await response.json();
      setBackendData(data);
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || 'Не удалось получить данные с бэкенда.');
      setBackendData(null);
    } finally {
      setIsFetchLoading(false);
    }
  };

  const activeLoading = isHookLoading || isFetchLoading;
  const anyError = hookError || fetchError;

  // Формируем чистый дебаг JSON на основе ответа бэкенда
  const debugJson = JSON.stringify({
    "🔑 [ФРОНТЕНД ДАННЫЕ]": {
      "Master PK Hex": masterPkHex || "Вычисляется..."
    },
    "🖥️ [ОТВЕТ БЭКЕНДА (PYTHON)]": backendData ? {
      "Success": backendData.success,
      "Total Balance XCH": backendData.total_balance_xch,
      "Total Balance Mojos": backendData.total_balance_mojos,
      "Addresses Scanned": backendData.addresses.length
    } : "Нажмите кнопку 'Сканировать кошелек'"
  }, null, 2);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
              Chia Public API Кошелек
            </h1>
            <p className="text-slate-400 text-sm mt-1">Клиент-серверная деривация и сканирование балансов</p>
          </div>

          {/* Общий баланс кошелька */}
          {backendData && (
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl px-6 py-3 shadow-lg">
              <span className="text-xs text-emerald-400 font-mono block uppercase tracking-wider font-semibold">Общий баланс</span>
              <span className="text-2xl font-black font-mono text-emerald-300">
                {backendData.total_balance_xch} <span className="text-sm font-normal">XCH</span>
              </span>
            </div>
          )}
        </div>

        {/* Настройки и Ввод */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Мнемоника (12 / 24 слов)</label>
            <textarea
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
              rows={2}
              value={mnemonicInput}
              onChange={(e) => {
                setMnemonicInput(e.target.value);
                setBackendData(null); // Сбрасываем старые балансы при изменении фразы
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center space-x-3">
              <label className="text-sm text-slate-400">Глубина сканирования:</label>
              <input
                type="number"
                min={1}
                max={500}
                className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center font-mono text-sm text-emerald-400 focus:outline-none focus:border-emerald-500"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>

            <button
              onClick={handleScanWallet}
              disabled={activeLoading || !masterPkHex}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
            >
              {activeLoading ? 'Сканирование ноды...' : 'Сканировать кошелек'}
            </button>
          </div>

          {anyError && (
            <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-400 text-xs rounded-lg font-mono">
              ⚠️ Ошибка: {anyError}
            </div>
          )}
        </div>

        {/* RAW JSON ОТЛАДКА */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-amber-400 font-mono text-sm">📋 СТАТУС API И КЛЮЧЕЙ</h3>
            <button
              onClick={() => navigator.clipboard.writeText(debugJson)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded transition font-mono active:scale-95"
            >
              Копировать JSON
            </button>
          </div>
          <div className="p-4 bg-slate-950">
            <pre className="text-xs font-mono text-slate-300 overflow-x-auto p-3 bg-slate-900/50 rounded border border-slate-800 max-h-48 select-all">
              {debugJson}
            </pre>
          </div>
        </div>

        {/* Таблица адресов и реальных балансов */}
        {!activeLoading && backendData && backendData.addresses.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-3 px-4 w-20 text-center">Индекс</th>
                    <th className="py-3 px-6">Адрес кошелька</th>
                    <th className="py-3 px-6 text-right">Текущий баланс</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {backendData.addresses.map((item) => (
                    <tr
                      key={item.index}
                      className={`transition ${item.has_balance ? 'bg-emerald-950/10 hover:bg-emerald-950/20' : 'hover:bg-slate-800/40'}`}
                    >
                      <td className="py-3 px-4 text-center text-emerald-400 font-bold">{item.index}</td>
                      <td className="py-3 px-6 text-slate-200 break-all">{item.address}</td>
                      <td className="py-3 px-6 text-right font-bold break-all">
                        {item.has_balance ? (
                          <span className="text-emerald-400">{item.balance_xch} XCH</span>
                        ) : (
                          <span className="text-slate-600">0 XCH</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
