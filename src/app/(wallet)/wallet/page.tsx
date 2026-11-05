
import { getServerSettings } from "@/lib/utils/server-utils"
import AuthClient from "../wallet/_components/AuthClient"
import { WalletController } from './WalletController'

export const instant = false

export default async function WalletPage() {
  const serverSettings = await getServerSettings()
  const isAuthServer = serverSettings.isAuth === true

  // 🚀 МОМЕНТАЛЬНЫЙ СЕРВЕРНЫЙ РОУТИНГ: 
  if (!isAuthServer) {
    return <AuthClient />
  }

  return <WalletController />
}
