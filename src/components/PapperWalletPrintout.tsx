'use client'

import React, { useEffect, useState } from "react"
import QRCode from "qrcode"

interface PaperWalletPrintoutProps {
  mnemonic: string
}

export function PapperWalletPrintout({ mnemonic }: PaperWalletPrintoutProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("")

  useEffect(() => {
    if (!mnemonic) return

    // Используем железно максимальный уровень коррекции H и высокое разрешение 800px
    QRCode.toDataURL(
      mnemonic.trim(), 
      { 
        errorCorrectionLevel: 'H', 
        margin: 3, // Широкое белое поле помогает камере Android зафиксировать границы
        width: 800, 
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, 
      (err, url) => {
        if (err) {
          console.error("Ошибка генерации QR-кода:", err)
          return
        }
        setQrDataUrl(url)
      }
    )
  }, [mnemonic])

  if (!mnemonic) return null
  const words = mnemonic.split(" ")

  return (
    <>
      {styleBlock}

      <div 
        id="xcha-print-sheet-root" 
        className="hidden print:flex flex-col justify-between bg-white text-black p-[15mm] font-sans w-[210mm] h-[297mm] box-border"
      >
        {/* ВЕРХНЯЯ ЧАСТЬ: Контент и слова */}
        <div className="w-full flex flex-col gap-5">
          {/* Шапка бланка */}
          <div className="flex justify-between items-end border-b-2 border-black pb-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-black">XCHA WALLET</h1>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                Paper Backup & Recovery Sheet
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold text-zinc-400">CHIA NETWORK (XCH)</span>
          </div>

          {/* Предупреждение безопасности */}
          <div className="border-2 border-black bg-zinc-50 p-4 rounded-xl text-xs font-bold text-black">
            <p className="uppercase tracking-wide font-black flex items-center gap-1.5 text-red-600">
              ⚠️ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ:
            </p>
            <p className="font-medium text-[11px] text-zinc-800 leading-normal mt-1.5">
              Храните этот лист в надежном физическом сейфе. Тот, у кого есть эти 24 слова или этот QR-код, имеет полный и необратимый контроль над вашими монетами XCH. Никогда не показывайте его на камеру компьютера или посторонним лицам.
            </p>
          </div>

          <div>
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-3 px-0.5">
              Мнемоническая фраза восстановления (Слова 1 — 24):
            </h3>
            
            {/* Сетка из 24 слов */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
              {words.map((word, index) => (
                <div key={index} className="flex items-center gap-2 border border-zinc-300 rounded-xl px-2.5 py-2 bg-white">
                  <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 h-5 w-5 rounded-full flex items-center justify-center shrink-0 border border-zinc-200">
                    {index + 1}
                  </span>
                  <span className="text-[13px] font-bold text-black font-mono tracking-tight">{word}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* НИЖНЯЯ ЧАСТЬ: Изолированная технологическая зона с огромным QR-кодом */}
        {qrDataUrl && (
          <div className="w-full flex flex-col items-center gap-2 border-t-2 border-dashed border-zinc-300 pt-6 mt-auto">
            <div className="text-center max-w-[400px] mb-1">
              <span className="text-[9px] font-black text-black uppercase tracking-wider bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
               Быстрый импорт 24 слов 
              </span>
              <p className="text-[9px] font-medium text-zinc-500 mt-1 leading-tight">
                Направьте камеру смартфона в приложении XCHA на QR-код ниже для моментального восстановления кошелька без ручного ввода слов.
              </p>
            </div>

            {/* Огромный QR-код с жесткими границами */}
            <div className="bg-white p-3 border-2 border-black rounded-2xl shadow-sm shrink-0">
              <img 
                src={qrDataUrl} 
                alt="XCHA Recovery QR" 
                className="w-40 h-40 block object-contain select-none pointer-events-none"
              />
            </div>
            
            <span className="text-[7px] font-mono font-black text-zinc-400 tracking-widest uppercase mt-0.5">
              Спецификация: BIP-39 Mnemonic // Error Correction: High (30%)
            </span>
          </div>
        )}
      </div>
    </>
  )
}

// Вынесли тяжелые стили печати, чтобы не засорять JSX структуру
const styleBlock = (
  <style dangerouslySetInnerHTML={{ __html: `
    @media print {
        @page {
            size: A4 portrait;
            margin: 0 !important;
        }
        html, body {
            visibility: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 210mm !important;
            height: 297mm !important;
        }
        div[class*="fixed"], 
        div[class*="absolute"], 
        div[class*="backdrop"], 
        div[role="dialog"], 
        [aria-modal="true"] {
            background: transparent !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
            border: none !important;
        }
        #xcha-print-sheet-root,
        #xcha-print-sheet-root * {
            visibility: visible !important;
        }
        #xcha-print-sheet-root {
            visibility: visible !important;
            display: flex !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 auto !important;
            padding: 15mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 9999999 !important;
        }
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    }
  `}} />
)
