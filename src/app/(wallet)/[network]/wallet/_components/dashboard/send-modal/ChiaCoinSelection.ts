/**
 * ЭТАЛОННЫЙ АЛГОРИТМ ПОДБОРА МОНЕТ CHIA (Largest Coins First)
 * Изучает массив монет кошелька и возвращает только те, которые необходимы
 * для покрытия чистой суммы перевода в Mojo.
 */
export function selectChiaCoins(amountStr: string, unspentCoins: any[]): any[] {
  if (!amountStr) return [];

  const xch = parseFloat(amountStr.trim().replace(",", "."));
  if (isNaN(xch) || xch <= 0) return [];

  const requiredMojos = Math.round(xch * 1_000_000_000_000);
  const coins = unspentCoins || [];

  // Сортируем абсолютно ВСЕ монеты от больших к мелким (b - a)
  const sortedCoins = [...coins].sort((a: any, b: any) => b.coin.amount - a.coin.amount);

  const selectedItems: any[] = [];
  let accumulatedAmount = 0;

  // Складываем монеты в массив, пока не наберется нужная сумма отправки
  for (const item of sortedCoins) {
    selectedItems.push(item);
    accumulatedAmount += item.coin.amount;
    if (accumulatedAmount >= requiredMojos) {
      break; // Набрали сумму отправки — выходим
    }
  }

  return selectedItems;
}
