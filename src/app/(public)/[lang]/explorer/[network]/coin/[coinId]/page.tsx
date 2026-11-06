import React, { Suspense } from "react"
import { CoinExplorerClient } from "./CoinExplorerClient"
import { Layers, Cpu, HardDrive, ChevronRight } from "lucide-react"
import { cookies } from "next/headers"

interface PageProps {
  params: Promise<{ lang: string; network: string; coinId: string }>
  searchParams: Promise<{ txId?: string }>
}

export const instant = false 

export default async function CoinExplorerPage({ params, searchParams }: PageProps) {
  const cookieStore = await cookies()
  const allCookies = cookieStore.toString()

  const dataPromise = (async () => {
    try {
      const { network, coinId } = await params
      const { txId } = await searchParams
      
      const rawTxId = txId || coinId
      const safeCoinId = coinId.startsWith("0x") ? coinId : `0x${coinId}`
      const safeTxId = rawTxId.startsWith("0x") ? rawTxId : `0x${rawTxId}`
      const safeNetwork = network || "mainnet"
      
      const backendUrl = "http://localhost:3000"
      
      const res = await fetch(
        `${backendUrl}/api/v1/transactions/track-tx?txId=${safeTxId}&targetCoinId=${safeCoinId}&network=${safeNetwork}`,
      )
      if (!res.ok) {
        console.error(`🔴 Server Fetch Failed with status: ${res.status}`)
        return null
      }
      return await res.json()
    } catch (err) {
      console.error("🔴 API Proxy Connection Refused on 3000:", err)
      return null
    }
  })()

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start py-6 flex-1 text-white">
      
      {/* ЛЕВАЯ ЧАСТЬ (7 КОЛОНОК) */}
      <div className="lg:col-span-7 space-y-6 w-full">
        
        {/* Хлебные крошки */}
        <div className="space-y-1.5 text-left">
          <nav className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-zinc-500 uppercase select-none">
            <span className="text-zinc-500">explorer</span>
            <ChevronRight size={10} className="text-zinc-600 shrink-0" />
            <span className="text-zinc-500">network</span>
            <ChevronRight size={10} className="text-zinc-600 shrink-0" />
            <span className="text-zinc-400">coin</span>
          </nav>

          <h1 className="text-2xl font-black tracking-tight text-white pt-0.5">
            Coin Transaction Overview
          </h1>
        </div>

        {/* МИНИМАЛИСТИЧНЫЙ СКЕЛЕТОН НА ЧИСТОМ TAILWIND */}
        <Suspense fallback={
          <div className="w-full space-y-4 animate-pulse">
            <div className="h-16 w-full bg-zinc-900 border border-zinc-850 rounded-[24px]" />
            <div className="bg-[#0c0c0e] border border-zinc-900 rounded-[24px] p-5 space-y-4 min-h-[300px]">
              <div className="h-10 bg-zinc-900/60 rounded-xl w-full" />
              <div className="h-10 bg-zinc-900/60 rounded-xl w-full" />
              <div className="h-12 bg-zinc-900/40 rounded-xl w-full mt-4" />
            </div>
          </div>
        }>
          <CoinExplorerClient 
            dataPromise={dataPromise}
            paramsPromise={params}
          />
        </Suspense>
      </div>

      {/* ПРАВАЯ ЧАСТЬ (5 КОЛОНОК) — БЕЗЛИЧНЫЙ ТЕХНИЧЕСКИЙ АНАЛИЗ С УЧЕТОМ РЕОРГОВ */}
      <div className="lg:col-span-5 space-y-4 w-full h-full lg:pt-16">
        
        {/* Карточка 1 */}
        <div className="bg-[#0c0c0e]/60 border border-zinc-900 p-4.5 rounded-[20px] space-y-2 text-left">
          <h4 className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Cpu size={14} className="text-[#FF2E93]" /> Что такое Coin ID?
          </h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
            Каждая монета в сети Chia — это уникальный смарт-контракт. Её ID (имя) создаётся автоматически на основе трёх параметров: ID родительской монеты, Puzzle Hash (хэша скрипта) и отправленной суммы.
          </p>
        </div>

        {/* Карточка 2 — ЖЕСТКИЙ ФИКС С УЧЕТОМ БЛОКЧЕЙН РЕОРГАНИЗАЦИЙ */}
        <div className="bg-[#0c0c0e]/60 border border-zinc-900 p-4.5 rounded-[20px] space-y-2 text-left">
          <h4 className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Layers size={14} className="text-blue-400" /> Очередь и валидация мемпула
          </h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
            Статус <span className="text-blue-400 font-bold font-mono">IN_MEMPOOL</span> означает, что транзакция ожидает включения в блок. При смене статуса на <span className="text-emerald-400 font-bold font-mono">CONFIRMED</span> запись вносится в текущую цепь. Обратите внимание: на стыке блоков при реорганизации блокчейна (Reorg) свежие транзакции могут временно возвращаться из блоков обратно в мемпул до стабилизации высоты цепи.
          </p>
        </div>

        {/* Карточка 3 */}
        <div className="bg-[#0c0c0e]/60 border border-zinc-900 p-4.5 rounded-[20px] space-y-2 text-left">
          <h4 className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <HardDrive size={14} className="text-zinc-500" /> Публичный аудит
          </h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
            Данные запрашиваются напрямую у нод блокчейна Chia. Информация является полностью открытой. Эту страницу можно отправить получателю перевода для независимой проверки статуса транзакции.
          </p>
        </div>

      </div>
      
    </div>
  )
}
