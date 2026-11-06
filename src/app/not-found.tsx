import React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

// Отключаем валидацию мгновенной статической навигации для этого роута в Next.js 16


export default async function NotFound() {
  return (
    <main className="w-full flex flex-col items-center justify-center py-16 px-4 text-center space-y-6 animate-in fade-in duration-200 selection:bg-[#FF2E93]/30">
      
      {/* Большой неоновый заголовок ошибки */}
      <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-r from-[#FF2E93] to-[#8B5CF6] bg-clip-text text-transparent leading-none">
        404
      </h1>

      {/* Информационный текстовый блок */}
      <div className="space-y-2">
        <h2 className="text-lg font-black text-white uppercase tracking-tight">
          Страница не найдена
        </h2>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed font-medium">
          Запрашиваемый криптографический путь в блокчейне Chia не существует или еще не был зафиксирован нодами сети.
        </p>
      </div>

      {/* Контрастная белая эталонная кнопка возврата на сервере */}
      <div className="pt-2">
        <Link 
          href="/ru" 
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase bg-white text-zinc-950 px-6 py-3.5 rounded-xl hover:bg-zinc-200 active:scale-98 transition-all shadow-lg shadow-white/5 mx-auto cursor-pointer"
        >
          <span>Вернуться в кошелек</span> 
          <ChevronRight size={12} className="text-[#FF2E93]" />
        </Link>
      </div>

    </main>
  )
}
