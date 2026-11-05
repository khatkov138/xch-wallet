'use client'

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, ExternalLink, Clock, ShieldCheck } from "lucide-react"
import { useSendModalContext } from "./SendModalContext"
import { formatMojoToXchString } from "@/lib/utils"
import Link from "next/link"
import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"

export function SendStepThree() {
  const { preparedSpendData, txId, txResponseData } = useSendModalContext()

  const network = useUserSettingsStore((state) => state.network);


  const audit = preparedSpendData?.audit_info

  // Атомарно забираем coin_id созданной монеты из ответа CLVM-инспектора
  const targetCoinId = React.useMemo(() => {
    const coins = txResponseData?.tracked_info?.created_coins
    if (Array.isArray(coins) && coins.length > 0) {
      return coins[0]?.coin_id || ""
    }
    return ""
  }, [txResponseData])


  // Изолированный атомарный поллинг по созданному коину
  const { data: trackData } = useQuery({
    queryKey: ["track-tx", txId, targetCoinId],
    queryFn: async () => {
      if (!txId || !targetCoinId) return null
      const res = await fetch(`/api/v1/transactions/track-tx?txId=${txId}&targetCoinId=${targetCoinId}&network=${network}`)
      if (!res.ok) throw new Error("Ошибка трекера")
      return res.json()
    },
    enabled: !!txId && !!targetCoinId,
    refetchInterval: (query) => {
      if (query.state.data?.status === "CONFIRMED") return false
      return 6000
    },
    staleTime: 0,
  })

  const blockchainStatus = trackData?.status || "IN_MEMPOOL"

  const getTotalOutflowMojo = () => {
    if (!audit) return 0n
    const target = BigInt(audit.disposition.target.amount_mojo)
    const networkFee = BigInt(audit.summary.fee_network_mojo)
    const dustFee = audit.summary.is_dust_fee_collected
      ? BigInt(audit.disposition.dust_fee.amount_mojo)
      : 0n
    return target + networkFee + dustFee
  }

  return (
    <div className="flex flex-col items-center justify-center py-4 px-2 min-h-[360px] animate-in fade-in zoom-in-98 duration-200 select-none">

      {/* Статус-бар прохождения транзакции */}
      <div className="w-full max-w-sm bg-zinc-900/50 border border-zinc-850 rounded-2xl p-5 space-y-4 mb-5 shadow-xl">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-400 font-medium">Статус перевода</span>
          {blockchainStatus === "CONFIRMED" ? (
            <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]">
              Завершено
            </span>
          ) : (
            <span className="text-amber-400 text-xs font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
              В процессе
            </span>
          )}
        </div>

        {/* Прогресс-бар */}
        <div className="relative w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-emerald-500 to-teal-400 ${blockchainStatus === "CONFIRMED" ? "w-full" : "w-1/2 animate-pulse"
              }`}
          />
        </div>

        {/* Описание с исправленным текстом и улучшенными контрастами */}
        <div className="flex items-start gap-3 pt-1">
          {blockchainStatus === "CONFIRMED" ? (
            <>
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="text-left space-y-0.5">
                <p className="text-white text-xs font-semibold">Монеты доставлены!</p>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Транзакция успешно включена в блокчейн Chia на высоте <span className="text-white font-mono font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">#{trackData?.block_height}</span>.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20 shrink-0">
                <Clock size={18} className="animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <div className="text-left space-y-0.5">
                <p className="text-white text-xs font-semibold">Отправлено в мемпул сети</p>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Ваша транзакция проверяется валидаторами. Обычно это занимает от 30 секунд до пары минут.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Списанная сумма крупным планом */}
      <div className="text-center space-y-1 mb-6">
        <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">Списано с баланса</span>
        <h2 className="text-2xl font-black text-white tracking-tight font-mono">
          {formatMojoToXchString(getTotalOutflowMojo())}
        </h2>
      </div>

      {txId && (
        <Link
          target="_blank"
          href={`/explorer/${network}/coin/${targetCoinId}?txId=${txId}`}
          className="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.98] cursor-pointer"
        >
          <span>Детали монеты в Explorer</span>
          <ExternalLink size={12} className="text-zinc-500" />
        </Link>
      )}
    </div>
  )
}
