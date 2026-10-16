'use client'

import React, { useState, useEffect } from "react"
import { Copy, Check, Eye, EyeOff, ShieldAlert, KeyRound, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getMasterPublicKeyFromMnemonic } from "@/lib/chia-crypto"

interface BackupCardProps {
  mnemonic: string
}

export function BackupCard({ mnemonic }: BackupCardProps) {
  const [showSeed, setShowSeed] = useState(false)
  const [copiedSeed, setCopiedSeed] = useState(false)
  const [copiedMpk, setCopiedMpk] = useState(false)

  const [masterPublicKey, setMasterPublicKey] = useState<string>("")
  const [isMpkLoading, setIsMpkLoading] = useState(false)

  // Вычисляем Master Public Key асинхронно только тогда, когда пользователь открыл просмотр
  useEffect(() => {
    if (!showSeed || !mnemonic) return

    async function calculateMpk() {
      try {
        setIsMpkLoading(true)
        const mpk = await getMasterPublicKeyFromMnemonic(mnemonic)
        setMasterPublicKey(mpk)
      } catch (error) {
        console.error("Ошибка генерации Master Public Key:", error)
      } finally {
        setIsMpkLoading(false)
      }
    }
    calculateMpk()
  }, [showSeed, mnemonic])

  const copySeedPhrase = () => {
    if (!mnemonic) return
    navigator.clipboard.writeText(mnemonic)
    setCopiedSeed(true)
    setTimeout(() => setCopiedSeed(false), 2000)
  }

  const copyMpk = () => {
    if (!masterPublicKey) return
    navigator.clipboard.writeText(masterPublicKey)
    setCopiedMpk(true)
    setTimeout(() => setCopiedMpk(false), 2000)
  }

  return (
    <Card className="bg-zinc-900/30 border border-zinc-900 rounded-[24px] shadow-xl overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400/90">
            <ShieldAlert size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Резервная копия</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSeed(!showSeed)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              {showSeed ? <EyeOff size={12} /> : <Eye size={12} />}
              <span>{showSeed ? "Скрыть" : "Показать фразы"}</span>
            </button>

            {showSeed && (
              <button
                onClick={copySeedPhrase}
                className="text-zinc-400 hover:text-white px-2 py-0.5 rounded-md bg-zinc-950 text-[10px] font-mono border border-zinc-850 flex items-center gap-1 transition-all cursor-pointer"
              >
                {copiedSeed ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                <span>{copiedSeed ? "ОК" : "Copy Seed"}</span>
              </button>
            )}
          </div>
        </div>

        {showSeed ? (
          <div className="space-y-3">
            {/* 1. Блок вывода 24 слов */}
            <div className="p-3 bg-zinc-950/80 border border-zinc-900 rounded-xl font-mono text-[11px] text-zinc-400 leading-relaxed tracking-tight select-all">
              {mnemonic || "Мнемоника не найдена в хранилище"}
            </div>

            {/* 2. Дополнительный блок: Master Public Key для разработчиков и кранов */}
            <div className="border-t border-zinc-900/60 pt-2.5 space-y-1.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <KeyRound size={11} className="text-zinc-500" />
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                    Master Public Key (m) — Для кранов
                  </span>
                </div>
                <button
                  onClick={copyMpk}
                  disabled={isMpkLoading || !masterPublicKey}
                  className={`flex items-center gap-1 text-[9px] font-bold bg-zinc-950/60 px-2 py-0.5 rounded-md border border-zinc-850 transition-all ${masterPublicKey && !isMpkLoading
                      ? "text-zinc-400 hover:text-white cursor-pointer active:scale-95"
                      : "text-zinc-600 border-zinc-900 cursor-not-allowed opacity-50"
                    }`}
                >
                  {copiedMpk ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                  <span>{copiedMpk ? "Скопирован" : "Copy MPK"}</span>
                </button>
              </div>

              <div className="bg-zinc-950/40 border border-zinc-900/50 p-2 rounded-lg font-mono text-[10px] text-zinc-500 break-all select-all min-h-[32px] flex items-center justify-center">
                {!isMpkLoading ? (
                  <span className="w-full text-left line-clamp-1">{masterPublicKey}</span>
                ) : (
                  <div className="flex items-center gap-1.5 text-zinc-600 text-[9px] font-bold uppercase tracking-wider animate-pulse">
                    <Loader2 size={10} className="animate-spin text-zinc-500" />
                    <span>Вычисление ключа...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Скрытое состояние по умолчанию */
          <div className="p-3 bg-zinc-950/30 border border-zinc-900/60 rounded-xl flex items-center justify-center text-[10px] text-zinc-600 font-bold uppercase tracking-wider select-none py-4">
            •••• •••• •••• •••• •••• ••••
          </div>
        )}
      </CardContent>
    </Card>
  )
}
