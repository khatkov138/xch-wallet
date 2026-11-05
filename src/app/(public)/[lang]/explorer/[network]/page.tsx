import { notFound } from 'next/navigation'
import { Search, Layers, ArrowUpRight, Cpu, HardDrive } from 'lucide-react'
import { isSupportedLanguage } from '@/config/i18n'

interface NetworkPageProps {
  params: Promise<{
    lang: string
    network: string
  }>
}

// 🎯 Отключаем жесткую instant-валидацию Next 16 для корректного чтения параметров URL
export const instant = false

export default async function ExplorerNetworkPage({ params }: NetworkPageProps) {
  const { lang, network } = await params

  // 🛡️ Строгая проверка URL. Любая дичь вроде /explorer/ethereum отправляет на 404
  if (!isSupportedLanguage(lang) || (network !== 'mainnet' && network !== 'testnet11')) {
    notFound()
  }

  const isMainnet = network === 'mainnet'

  return (
    <div className="w-full space-y-8 py-4 animate-in fade-in duration-300 text-[9px] selection:bg-[#FF2E93]/30">
      
      {/* 1. ЗАГОЛОВОК И ШАПКА ХАБА (Чистый вид без лишних кнопок переключения сетей) */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Chia Network <span className="bg-gradient-to-r from-[#FF2E93] to-[#8B5CF6] bg-clip-text text-transparent">Explorer</span>
        </h1>
        <p className="text-xs text-zinc-500 font-medium font-mono uppercase tracking-wider">
          Текущий сегмент: <span className={isMainnet ? 'text-emerald-400' : 'text-[#FF2E93]'}>{network}</span>
        </p>
      </div>

      {/* 2. ПРЕМИАЛЬНАЯ ПОИСКОВАЯ СТРОКА */}
      <div className="w-full max-w-3xl mx-auto relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#FF2E93] transition-colors">
          <Search size={16} />
        </div>
        <input 
          type="text" 
          placeholder={`Поиск в сети ${network.toUpperCase()} по адресу, хэшу транзакции, блоку или puzzle hash...`}
          className="w-full h-14 pl-12 pr-4 bg-[#0c0c0e]/80 border border-zinc-900 rounded-2xl text-white font-mono text-xs placeholder-zinc-600 focus:outline-none focus:border-[#FF2E93]/60 focus:ring-1 focus:ring-[#FF2E93]/30 transition-all shadow-2xl backdrop-blur-md"
        />
      </div>

      {/* 3. СЕТКА ГЛОБАЛЬНЫХ МЕТРИК СЕТИ (Как на Spacescan) */}
      <div className="w-full max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0c0c0e]/60 border border-zinc-900 rounded-2xl p-4 shadow-xl flex items-center gap-3">
          <div className="p-2 bg-zinc-950/80 border border-zinc-900 rounded-xl text-zinc-400">
            <HardDrive size={14} />
          </div>
          <div>
            <p className="text-zinc-550 font-bold uppercase text-[7px] tracking-wider">NetSpace</p>
            <p className="text-sm font-black text-white font-mono mt-0.5">{isMainnet ? '24.85 EiB' : '142.5 TiB'}</p>
          </div>
        </div>

        <div className="bg-[#0c0c0e]/60 border border-zinc-900 rounded-2xl p-4 shadow-xl flex items-center gap-3">
          <div className="p-2 bg-zinc-950/80 border border-zinc-900 rounded-xl text-emerald-400">
            <Layers size={14} />
          </div>
          <div>
            <p className="text-zinc-550 font-bold uppercase text-[7px] tracking-wider">Текущий блок</p>
            <p className="text-sm font-black text-emerald-400 font-mono mt-0.5">#6,432,981</p>
          </div>
        </div>

        <div className="bg-[#0c0c0e]/60 border border-zinc-900 rounded-2xl p-4 shadow-xl flex items-center gap-3">
          <div className="p-2 bg-zinc-950/80 border border-zinc-900 rounded-xl text-purple-400">
            <Cpu size={14} />
          </div>
          <div>
            <p className="text-zinc-550 font-bold uppercase text-[7px] tracking-wider">Цена XCH</p>
            <p className="text-sm font-black text-white font-mono mt-0.5">{isMainnet ? '$14.22' : 'Test Token'}</p>
          </div>
        </div>

        <div className="bg-[#0c0c0e]/60 border border-zinc-900 rounded-2xl p-4 shadow-xl flex items-center gap-3">
          <div className="p-2 bg-zinc-950/80 border border-zinc-900 rounded-xl text-zinc-500">
            <ArrowUpRight size={14} />
          </div>
          <div>
            <p className="text-zinc-550 font-bold uppercase text-[7px] tracking-wider">Комиссия сети</p>
            <p className="text-sm font-black text-zinc-400 font-mono mt-0.5">0 MOJO</p>
          </div>
        </div>
      </div>

      {/* 4. ТАБЛИЦЫ ЗАГЛУШЕК (Два полноценных столбца: Latest Blocks и Latest Transactions) */}
      <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        
        {/* Столбец: Latest Blocks */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-[8px] font-black text-zinc-500 uppercase tracking-wider px-1">
            <span className="flex items-center gap-1.5"><Layers size={10} /> Latest Blocks</span>
            <span className="hover:text-[#FF2E93] transition-colors cursor-pointer font-bold">View all →</span>
          </div>
          <div className="bg-[#0c0c0e]/40 border border-zinc-900 rounded-2xl p-2 divide-y divide-zinc-900/40 shadow-xl backdrop-blur-sm">
            {/* Ряд 1 */}
            <div className="flex justify-between items-center p-2.5 text-[9px]">
              <div>
                <p className="font-black text-emerald-400 font-mono">9,532,906</p>
                <p className="text-[7px] text-zinc-500 font-medium">53 seconds ago</p>
              </div>
              <div className="text-right">
                <p className="text-zinc-300 font-mono font-medium">Farmer: xch1mjzw...v2wxy</p>
                <p className="text-[7px] text-zinc-550 font-mono font-bold mt-0.5">1774 txns</p>
              </div>
            </div>
            {/* Ряд 2 */}
            <div className="flex justify-between items-center p-2.5 text-[9px]">
              <div>
                <p className="font-black text-emerald-400 font-mono">9,532,905</p>
                <p className="text-[7px] text-zinc-500 font-medium">2 minutes ago</p>
              </div>
              <div className="text-right">
                <p className="text-zinc-300 font-mono font-medium">Farmer: xch1uyfn...5c5r3</p>
                <p className="text-[7px] text-zinc-550 font-mono font-bold mt-0.5">No transactions</p>
              </div>
            </div>
            {/* Ряд 3 */}
            <div className="flex justify-between items-center p-2.5 text-[9px]">
              <div>
                <p className="font-black text-emerald-400 font-mono">9,532,904</p>
                <p className="text-[7px] text-zinc-500 font-medium">3 minutes ago</p>
              </div>
              <div className="text-right">
                <p className="text-zinc-300 font-mono font-medium">Farmer: xch1gp3y...gvuhn</p>
                <p className="text-[7px] text-zinc-550 font-mono font-bold mt-0.5">No transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Столбец: Latest Transactions */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-[8px] font-black text-zinc-500 uppercase tracking-wider px-1">
            <span className="flex items-center gap-1.5"><ArrowUpRight size={10} /> Latest Transactions</span>
            <span className="hover:text-[#FF2E93] transition-colors cursor-pointer font-bold">View all →</span>
          </div>
          <div className="bg-[#0c0c0e]/40 border border-zinc-900 rounded-2xl p-2 divide-y divide-zinc-900/40 shadow-xl backdrop-blur-sm">
            {/* Ряд 1 */}
            <div className="flex justify-between items-center p-2.5 text-[9px]">
              <div>
                <p className="font-mono text-zinc-300 font-bold truncate max-w-[120px]">0x0004fe9...d63a7</p>
                <p className="text-[7px] text-zinc-500 font-medium mt-0.5">To: xch1ck37...4n8h</p>
              </div>
              <div className="text-right">
                <p className="font-black text-white font-mono">0.01534227 XCH</p>
                <p className="text-[7px] text-zinc-550 font-medium mt-0.5">53 seconds ago</p>
              </div>
            </div>
            {/* Ряд 2 */}
            <div className="flex justify-between items-center p-2.5 text-[9px]">
              <div>
                <p className="font-mono text-zinc-300 font-bold truncate max-w-[120px]">0x0016857...7afc2</p>
                <p className="text-[7px] text-zinc-500 font-medium mt-0.5">To: xch1vet0...fh7q</p>
              </div>
              <div className="text-right">
                <p className="font-black text-white font-mono">0.16593120 XCH</p>
                <p className="text-[7px] text-zinc-550 font-medium mt-0.5">53 seconds ago</p>
              </div>
            </div>
            {/* Ряд 3 */}
            <div className="flex justify-between items-center p-2.5 text-[9px]">
              <div>
                <p className="font-mono text-zinc-300 font-bold truncate max-w-[120px]">0x005bf7d...f1ed6</p>
                <p className="text-[7px] text-zinc-500 font-medium mt-0.5">To: xch15q9m...krzj</p>
              </div>
              <div className="text-right">
                <p className="font-black text-white font-mono">0.12721328 XCH</p>
                <p className="text-[7px] text-zinc-550 font-medium mt-0.5">53 seconds ago</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
