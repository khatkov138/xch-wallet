

interface PaperWalletPrintoutProps {
    mnemonic: string
  
}

export function PapperWalletPrintout({ mnemonic }: PaperWalletPrintoutProps) {
    if (!mnemonic) return null
    const words = mnemonic.split(" ")

    return (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-12 font-sans z-50 min-h-screen w-full">
            {/* Шапка бланка */}
            <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-black">XCHA WALLET</h1>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                        Paper Backup & Recovery Sheet
                    </p>
                </div>
                <div className="text-right text-[9px] font-mono text-zinc-400">
                    <p>Сгенерировано в XCHA App</p>
                    <p>{new Date().toLocaleDateString()}</p>
                </div>
            </div>

            {/* Защитный блок */}
            <div className="border border-red-500 bg-red-50 p-4 rounded-xl mb-6 text-xs font-bold text-red-700">
                <p className="uppercase tracking-wide font-black">⚠️ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ:</p>
                <p className="font-medium text-[11px] text-zinc-700 leading-normal mt-1">
                    Храните этот лист в надежном физическом сейфе. Тот, у кого есть эти 24 слова, имеет полный контроль над вашими монетами XCH.
                </p>
            </div>

          

            {/* Красивая сетка 24 слов без лишнего мусора дашборда */}
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-2.5 px-0.5">
                Мнемоническая фраза восстановления:
            </h3>
            <div className="grid grid-cols-3 gap-2">
                {words.map((word, index) => (
                    <div key={index} className="flex items-center gap-2 border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-white">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 h-5 w-5 rounded-full flex items-center justify-center shrink-0">
                            {index + 1}
                        </span>
                        <span className="text-[13px] font-bold text-zinc-900 font-mono">{word}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}