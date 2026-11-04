'use client'

import { useState } from "react"


import { useWalletWs } from "@/hooks/useWalletWs"
import { BalanceSection } from "./_components/dashboard/BalanceSection"
import { AddressCard } from "./_components/dashboard/AddressCard"
import { ActionButtons } from "./_components/dashboard/ActionButtons"
import { ActivityList } from "./_components/dashboard/ActivityList"
import { BackupCard } from "./_components/dashboard/BackupCard"
import { ReceiveModal } from "./_components/dashboard/ReceiveModal"
import { SendModal } from "./_components/dashboard/send-modal/SendModal"

export default function DashboardClient() {
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isSendOpen, setIsSendOpen] = useState(false)

  // 🔌 Подключаем единый WebSocket-канал. 
  // Хук внутри себя автоматически заберет текущую сеть из Context API.
  useWalletWs()

  // Возвращаем строго основной контент дашборда авторизованного кошелька XCHIA
  return (
    <>
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        <BalanceSection />
        <AddressCard />
        <ActionButtons
          onReceiveClick={() => setIsReceiveOpen(true)}
          onSendClick={() => setIsSendOpen(true)}
        />
        <ActivityList />
        <BackupCard />
      </div>

      <ReceiveModal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} />
      <SendModal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} />
    </>
  )
}
