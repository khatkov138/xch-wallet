import React from "react"
import { notFound } from "next/navigation"

interface ExplorerNetworkLayoutProps {
  children: React.ReactNode
  params: Promise<{ network: string }>
}


export default async function ExplorerNetworkLayout({ children, params }: ExplorerNetworkLayoutProps) {
  const resolvedParams = await params
  const network = resolvedParams?.network

  // 🛡️ ЖЕСТКИЙ СЕРВЕРНЫЙ ФИЛЬТР: Пропускаем только mainnet и testnet11
  const allowedNetworks = ["mainnet", "testnet11"]
  
  if (!network || !allowedNetworks.includes(network)) {
    // Если в URL ввели левую дичь — Next.js мгновенно прервет рендер и выдаст 404 страницу
    notFound()
  }

  return <>{children}</>
}
