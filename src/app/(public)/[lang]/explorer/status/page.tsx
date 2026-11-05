
import { Suspense } from "react"
import StatusClient from "./StatusClient"

export default async function Page() {
  return (<Suspense fallback={<div className="p-8 text-center text-xs font-medium text-zinc-500 animate-pulse">Загрузка эксплорера...</div>}>
    <StatusClient />
  </Suspense>)
}
