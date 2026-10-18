'use client'

import React, { useState, useEffect } from "react"
import { X, Copy, Check, Share2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import QRCode from "qrcode"

// ИСПРАВЛЕНИЕ: Жестко зафиксировали интерфейс пропсов строго под требования page.tsx
interface ReceiveModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string
}

export function ReceiveModal({ isOpen, onClose, walletAddress }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false)
  const [qrSvg, setQrSvg] = useState<string>("")

  const isAddressLoaded = walletAddress && walletAddress.trim() !== ""

  // Векторная генерация QR-кода прямо в браузере без внешних запросов
  useEffect(() => {
    if (isAddressLoaded && isOpen) {
      QRCode.toString(
        walletAddress,
        {
          type: "svg",
          margin: 1,
          width: 160,
          color: {
            dark: "#09090b",  // Цвет модулей QR-кода
            light: "#ffffff", // Чистый белый фон для сканирования
          },
        },
        (err, string) => {
          if (!err && string) setQrSvg(string)
        }
      )
    }
  }, [walletAddress, isOpen, isAddressLoaded])

  // Если шторка закрыта — не рендерим ничего
  if (!isOpen) return null

  const handleCopy = async () => {
    if (!isAddressLoaded) return
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Ошибка копирования адреса:", err)
    }
  }

  const handleShare = async () => {
    if (!isAddressLoaded) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Мой Chia (XCH) Адрес',
          text: walletAddress,
        })
      } catch (e) {
        console.log("Пользователь отменил шеринг")
      }
    } else {
      await handleCopy()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-300 animate-in fade-in">

      {/* Закрытие модалки при клике на задний фон */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Контейнер шторки — выезжает снизу вверх */}
      <div className="relative w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-[32px] p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300 z-10">

        {/* Хэндл шторки для удобного свайпа визуально */}
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto -mt-2 mb-2 select-none" />

        {/* Заголовок модалки */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-white">Получить XCH</h3>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide mt-0.5">Экосистема Chia Network</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer active:scale-95 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Блок QR-кода с твоим фирменным неоновым свечением под ним */}
        <div className="flex flex-col items-center justify-center space-y-4 py-2">
          <div className="relative p-4 bg-white rounded-3xl shadow-xl shadow-[#FF2E93]/5 border-4 border-zinc-950 ring-1 ring-zinc-800 min-w-[192px] min-h-[192px] flex items-center justify-center">
            {qrSvg ? (
              // Отрисовываем чистый локальный SVG-код
              <div 
                className="w-40 h-40 select-none" 
                dangerouslySetInnerHTML={{ __html: qrSvg }} 
              />
            ) : (
              <div className="text-zinc-500 text-xs font-bold animate-pulse uppercase tracking-wider">
                Создание QR...
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
            Сканируйте для перевода
          </span>
        </div> 

        {/* Отображение полного Chia-адреса */}
        <Card className="bg-zinc-950/60 border border-zinc-900 rounded-[20px]">
          <CardContent className="p-3.5 space-y-2">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-0.5">
              Ваш публичный адрес кошелька
            </div>
            <div className="font-mono text-xs text-zinc-300 break-all select-all loading-relaxed tracking-tight bg-zinc-900/40 p-3 rounded-xl border border-zinc-900">
              {isAddressLoaded ? walletAddress : "Ожидание деривации..."}
            </div>
          </CardContent>
        </Card>

        {/* Финтех кнопки нижнего ряда: Копировать и Поделиться */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleCopy}
            disabled={!isAddressLoaded}
            className={`h-12 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border-none shadow-md ${copied
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10'
                : 'bg-white hover:bg-zinc-200 text-black shadow-white/5 active:scale-[0.98]'
              }`}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? "СКОПИРОВАН" : "КОПИРОВАТЬ"}</span>
          </Button>

          <Button
            onClick={handleShare}
            disabled={!isAddressLoaded}
            className="h-12 bg-zinc-950 hover:bg-zinc-900 text-white border border-zinc-800 font-black text-xs rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
          >
            <Share2 size={15} className="text-[#FF2E93]" />
            <span>ПОДЕЛИТЬСЯ</span>
          </Button>
        </div>

      </div>
    </div>
  )
}
