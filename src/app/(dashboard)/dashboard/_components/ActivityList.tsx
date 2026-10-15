'use client'

import React from "react"
import { ArrowUpRight, ArrowDownLeft, Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function ActivityList() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 px-0.5 text-zinc-500">
        <Layers size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Последняя активность</span>
      </div>
      
      <Card className="bg-zinc-900/20 border border-zinc-900/50 rounded-[24px] overflow-hidden">
        <CardContent className="p-2 space-y-1">
          {/* Транзакция 1 */}
          <div className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <ArrowDownLeft size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Получено XCH</p>
                <p className="text-[10px] font-medium text-zinc-500">xch1...490w</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-emerald-400">+2.5000 XCH</p>
              <p className="text-[9px] font-bold text-zinc-500">14 Окт, 18:24</p>
            </div>
          </div>

          {/* Транзакция 2 */}
          <div className="flex items-center justify-between p-2.5 hover:bg-zinc-900/40 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                <ArrowUpRight size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Отправлено XCH</p>
                <p className="text-[10px] font-medium text-zinc-500">xch1...8z49</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-zinc-200">-0.1024 XCH</p>
              <p className="text-[9px] font-bold text-zinc-500">12 Окт, 11:05</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
