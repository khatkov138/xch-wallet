import React from "react"
import Link from "next/link"
import { WalletLanguage } from "@/config/i18n"

interface FooterProps {
  currentLang?: WalletLanguage
}

export function Footer({ currentLang }: FooterProps) {
  // Автоматический префикс для сохранения локали в путях эксплорера и статуса
  const langPrefix = currentLang ? `/${currentLang}` : "/en"

  return (
    <footer className="w-full select-none font-sans text-[10px]">
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-4 text-left">
        
        {/* БЛОК БРЕНДА (Левая колонка) */}
        <div className="md:col-span-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-xs tracking-tight">
              XCH<span className="text-[#FF2E93]">IA</span>
            </span>
          </div>
          <p className="text-zinc-550 font-medium leading-relaxed max-w-[200px]">
            Премиальный некастодиальный веб-кошелек и infrastructure-эксплорер для Chia Network.
          </p>
          <div className="flex items-center gap-3 pt-1 text-zinc-650">
            <span className="hover:text-white transition-colors cursor-pointer">Twitter</span>
            <span className="hover:text-white transition-colors cursor-pointer">Discord</span>
          </div>
        </div>

        {/* СЕТКА ССЫЛОК (Правые колонки) */}
        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-6">
          
          {/* Колонка 1: NETWORKS (URL-first переключение) */}
          <div className="space-y-2.5">
            <h4 className="font-black text-zinc-400 uppercase tracking-wider text-[9px]">Networks</h4>
            <ul className="space-y-2 font-medium text-zinc-500 font-mono">
              <li>
                <Link href={`${langPrefix}/explorer/mainnet`} className="hover:text-emerald-400 transition-colors">
                  Mainnet
                </Link>
              </li>
              <li>
                <Link href={`${langPrefix}/explorer/testnet11`} className="hover:text-[#FF2E93] transition-colors">
                  Testnet11
                </Link>
              </li>
            </ul>
          </div>

          {/* Колонка 2: DISCOVER */}
          <div className="space-y-2.5">
            <h4 className="font-black text-zinc-400 uppercase tracking-wider text-[9px]">Discover</h4>
            <ul className="space-y-2 font-medium text-zinc-500">
              <li>
                <Link href={`${langPrefix}/explorer`} className="hover:text-white transition-colors">
                  Blockchain Explorer
                </Link>
              </li>
              <li>
                <Link href="/wallet" className="hover:text-white transition-colors">
                  Web Wallet
                </Link>
              </li>
              {/* 🎯 ДОБАВИЛИ ССЫЛКУ НА НАШУ НОВУЮ СТАТУС-ПАНЕЛЬ С СОХРАНЕНИЕМ ЛОКАЛИ */}
              <li>
                <Link href={`${langPrefix}/nodes/status`} className="hover:text-white transition-colors flex items-center gap-1">
                  Nodes Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Колонка 3: RESOURCES */}
          <div className="space-y-2.5">
            <h4 className="font-black text-zinc-400 tracking-wider text-[9px] uppercase">Resources</h4>
            <ul className="space-y-2 font-medium text-zinc-500">
              <li>
                <span className="hover:text-white transition-colors cursor-pointer">GitHub Source</span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-pointer">API Documentation</span>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* НИЖНЯЯ ЛИНИЯ КОПИРАЙТА */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between border-t border-zinc-900/30 mt-8 pt-4 text-zinc-650 font-medium text-[9px]">
        <p>Copyright © 2026 - xchia.io | T&C</p>
        <p className="font-mono text-zinc-700">Next.js 16 & React 19</p>
      </div>
    </footer>
  )
}
