
/**
 * Рендерит Chia-адрес целиком с красивым переносом строго по центру.
 * Намертво блокирует синее выделение текста в браузере при кликах и тапах.
 * Подсвечивает начало (белый) и важный хвост для сверки (розовый).
 */
export const renderHighlightedAddress = (addr: string) => {
  if (!addr) return null
  
  // Определяем длину префикса: для тестнета txch1... длина 9, для майннета xch1... длина 8
  const prefixLength = addr.startsWith("txch1") ? 9 : 8 
  
  const firstPart = addr.substring(0, prefixLength)
  const lastPart = addr.substring(addr.length - 6)
  const middlePart = addr.substring(prefixLength, addr.length - 6)

  return (
    <div className="font-mono text-xs tracking-wide break-all text-center leading-relaxed max-w-full px-1 select-none [user-select:none] [-webkit-user-select:none] [-moz-user-select:none] [-ms-user-select:none]">
      {/* Начало адреса — жирное белое */}
      <strong className="text-white font-extrabold select-none">{firstPart}</strong>
      {/* Вся середина адреса — приглушенный серый */}
      <span className="text-zinc-500 font-medium select-none">{middlePart}</span>
      {/* Конец адреса — яркий розовый (зона валидации) */}
      <strong className="text-[#FF2E93] font-extrabold select-none">{lastPart}</strong>
    </div>
  )
}
