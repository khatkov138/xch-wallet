
import { Suspense } from "react"
import DashboardClient from "./DashboardClient"
import { Loader2 } from "lucide-react"


// Этот файл рендерится на сервере и создает правильную Suspense-границу
export default function Page() {

  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute w-[250px] h-[250px] bg-[#FF2E93]/10 blur-[80px] rounded-full animate-pulse pointer-events-none" />
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="bg-white text-black font-black text-xl px-5 py-2.5 rounded-2xl tracking-tight shadow-2xl select-none">
              XCH<span className="text-[#FF2E93]">A</span>
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF2E93] border-2 border-zinc-950" />
            </div>
            <Loader2 size={16} className="animate-spin text-zinc-500" />
          </div>
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  )
}
