interface PaperWalletPrintoutProps {
    mnemonic: string
}

export function PapperWalletPrintout({ mnemonic }: PaperWalletPrintoutProps) {
    if (!mnemonic) return null
    const words = mnemonic.split(" ")

    return (
        <>
            {/* 🎯 ЖЕЛЕЗОБЕТОННОЕ УНИЧТОЖЕНИЕ ЛЮБЫХ МОДАЛОК И ОВЕРЛЕЕВ НА ПЕЧАТИ */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    /* 1. Прячем дефолтные поля, дату и URL от браузера */
                    @page {
                        size: A4 portrait;
                        margin: 0 !important;
                    }
                    
                    /* 2. Полностью гасим видимость всего сайта */
                    html, body {
                        visibility: hidden !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        width: 210mm !important;
                        height: 297mm !important;
                    }

                    /* 3. ВЫРЕЗАЕМ ЛЮБЫЕ МОДАЛКИ, фиксированные оверлеи, бэкдропы, размытия и обертки диалогов */
                    div[class*="fixed"], 
                    div[class*="absolute"], 
                    div[class*="backdrop"], 
                    div[role="dialog"], 
                    [aria-modal="true"] {
                        background: transparent !important;
                        backdrop-filter: none !important;
                        -webkit-backdrop-filter: none !important;
                        box-shadow: none !important;
                        border: none !important;
                    }

                    /* 4. Принудительно возвращаем видимость ТОЛЬКО нашему бланку и его дочерним элементам */
                    #xcha-print-sheet-root,
                    #xcha-print-sheet-root * {
                        visibility: visible !important;
                    }

                    /* 5. Намертво фиксируем А4 холст в левом верхнем углу печатной области */
                    #xcha-print-sheet-root {
                        visibility: visible !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        margin: 0 auto !important;
                        padding: 15mm !important;
                        box-sizing: border-box !important;
                        background: #ffffff !important;
                        z-index: 9999999 !important;
                    }

                    /* 6. Форсируем печать фоновых цветов (серые кружки, красная плашка) */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}} />

            {/* Контейнер бланка */}
            <div 
                id="xcha-print-sheet-root" 
                className="hidden print:block bg-white text-black p-[15mm] font-sans w-[210mm] h-[297mm] box-border"
            >
                {/* Шапка бланка */}
                <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-5">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-black">XCHA WALLET</h1>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                            Paper Backup & Recovery Sheet
                        </p>
                    </div>
                    <div className="text-right text-[9px] font-mono text-zinc-500">
                        <p>Сгенерировано в XCHA App</p>
                        <p>{new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Защитный блок */}
                <div className="border border-red-500 bg-red-50 p-4 rounded-xl mb-5 text-xs font-bold text-red-700">
                    <p className="uppercase tracking-wide font-black">⚠️ КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ:</p>
                    <p className="font-medium text-[11px] text-zinc-700 leading-normal mt-1">
                        Храните этот лист в надежном физическом сейфе. Тот, у кого есть эти 24 слова, имеет полный контроль над вашими монетами XCH.
                    </p>
                </div>

                {/* Заголовок сетки */}
                <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-2.5 px-0.5">
                    Мнемоническая фраза восстановления:
                </h3>
                
                {/* Сетка из 24 слов */}
                <div className="grid grid-cols-3 gap-2.5">
                    {words.map((word, index) => (
                        <div key={index} className="flex items-center gap-2 border border-zinc-300 rounded-xl px-2.5 py-1.5 bg-white">
                            <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 h-5 w-5 rounded-full flex items-center justify-center shrink-0 border border-zinc-200">
                                {index + 1}
                            </span>
                            <span className="text-[13px] font-bold text-black font-mono tracking-tight">{word}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
