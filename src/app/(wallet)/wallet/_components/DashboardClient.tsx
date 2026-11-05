'use client'

import { useState } from "react"



import { BalanceSection } from "./dashboard/BalanceSection"
import { AddressCard } from "./dashboard/AddressCard"
import { ActionButtons } from "./dashboard/ActionButtons"
import { ActivityList } from "./dashboard/ActivityList"
import { BackupCard } from "./dashboard/BackupCard"
import { ReceiveModal } from "./dashboard/ReceiveModal"
import { SendModal } from "./dashboard/send-modal/SendModal"


export default function DashboardClient() {
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isSendOpen, setIsSendOpen] = useState(false)

 
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
