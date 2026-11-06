'use client'

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Clock } from "lucide-react"
import { useParams } from "next/navigation"

import { useUserSettingsStore } from "@/providers/UserSettnigsProvider"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useSendModalContext } from "../SendModalContext"
import { TransactionReviewCard } from "../TransactionReviewCard"

export function SendStep3() {
  const { txResponseData, onCloseForm } = useSendModalContext()
  const network = useUserSettingsStore((state) => state.network)
  const language = useUserSettingsStore((state) => state.language)

  const txId = txResponseData?.tx_id || ""
  const currentLangStr = String(language || "ru").toLowerCase()

  const targetCoinId = React.useMemo(() => {
    const coins = txResponseData?.tracked_info?.created_coins
    if (Array.isArray(coins) && coins.length > 0) {
      return coins[0]?.coin_id || ""
    }
    return ""
  }, [txResponseData])

  // Поллинг мемпула сети Chia (Опрос ноды каждые 6 секунд)
  const { data: trackData } = useQuery({
    queryKey: ["track-tx", txId, targetCoinId, network],
    queryFn: async () => {
      if (!txId || !targetCoinId || !network) return null
      const res = await fetch(`/api/v1/transactions/track-tx?txId=${txId}&targetCoinId=${targetCoinId}&network=${network}`)
      if (!res.ok) throw new Error("Ошибка трекера")
      return res.json()
    },
    enabled: !!txId && !!targetCoinId && !!network,
    refetchInterval: (query) => {
      if (query.state.data?.status === "CONFIRMED") return false
      return 6000
    },
    staleTime: 0,
  })

  const blockchainStatus = trackData?.status || "IN_MEMPOOL"
  const isConfirmed = blockchainStatus === "CONFIRMED"

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-98 duration-200 relative select-none">
      
      {/* 🎯 1. КАРТОЧКА РЕВЬЮ НА СВОЁМ ЗАКОННОМ ПЕРВОМ МЕСТЕ */}
      <TransactionReviewCard />
      
      {/* 🎯 2. МОНОЛИТНЫЙ БЛОК СТАТУСА И КНОПКИ EXPLORER СТРОГО СНИЗУ */}
      <div className="flex flex-col gap-3 bg-zinc-950 border border-zinc-850 p-4 rounded-xl relative z-10">
        
        {/* Индикатор в синих тонах (вместо жёлтого) */}
        <div className="flex items-center justify-between">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border transition-all ${
            isConfirmed 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isConfirmed ? "bg-emerald-400" : "bg-blue-400"}`} />
            {isConfirmed ? "ТРАНЗАКЦИЯ ПОДТВЕРЖДЕНА" : "ОЖИДАНИЕ БЛОКЧЕЙНА"}
          </div>
          
          <span className="text-[10px] font-mono text-zinc-500">
            Сеть: {network}
          </span>
        </div>

        {/* Человеческое понятное описание */}
        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
          {isConfirmed ? (
            <>
              Монеты успешно доставлены получателю и включены в блок Chia на высоте{" "}
              <strong className="text-white font-mono bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                #{trackData?.block_height}
              </strong>.
            </>
          ) : (
            <>
              Транзакция успешно отправлена в очередь сети. Мы отслеживаем её статус в реальном времени, обычно валидация занимает пару минут.
            </>
          )}
        </p>

        {/* Кнопка отслеживания, интегрированная прямо внутрь нижнего синего бандла */}
        {txId && targetCoinId && (
          <Link
            target="_blank"
            href={`/${currentLangStr}/explorer/${network}/coin/${targetCoinId}?txId=${txId}`}
            className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 w-full h-10 rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer group mt-1"
          >
            <span>Отследить перевод в Explorer</span>
            <ExternalLink size={12} className="text-[#FF2E93] font-black transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        )}
      </div>

      {/* 3. Второстепенная кнопка закрытия за пределами блоков */}
      <Button
        type="button"
        variant="ghost"
        onClick={onCloseForm}
        className="w-full h-10 bg-transparent hover:bg-zinc-950 text-zinc-500 hover:text-white rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center cursor-pointer transition-all duration-200"
      >
        Закрыть окно терминала
      </Button>

    </div>
  )
}
