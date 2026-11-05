import { cookies } from 'next/headers'
import AuthClient from "../wallet/_components/AuthClient"
import { WalletController } from './WalletController'

export const instant = false

export default async function WalletPage() {
  // 🍪 Читаем куку авторизации на стороне сервера прямо в Server Component (без use client)
  const cookieStore = await cookies()
  const isAuthServer = cookieStore.get('xchia-is-auth')?.value === 'true'

  // 🚀 МОМЕНТАЛЬНЫЙ СЕРВЕРНЫЙ РОУТИНГ: 
  // Если кошелька нет — сервер сразу, без загрузки лишних скриптов, отдает AuthClient.
  if (!isAuthServer) {
    return <AuthClient />
  }

  // Если кошелек есть — отдаем контроллер, который мгновенно отрисует Dashboard
  return <WalletController />
}
