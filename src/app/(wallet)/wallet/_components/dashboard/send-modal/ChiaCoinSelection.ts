export function selectChiaCoins(amountStr: string, unspentCoins: any[]): any[] {
  if (!amountStr) return [];

  const xch = parseFloat(amountStr.trim().replace(",", "."));
  if (isNaN(xch) || xch <= 0) return [];

  const requiredMojos = Math.round(xch * 1_000_000_000_000);
  const coins = unspentCoins || [];

  const sortedCoins = [...coins].sort((a: any, b: any) => b.coin.amount - a.coin.amount);

  const selectedItems: any[] = [];
  let accumulatedAmount = 0;

  for (const item of sortedCoins) {
    // 🌟 ЗАЩИТА ОТ ДВОЙНЫХ ТРАТ: игнорируем и сожженные инпуты, и не подтвержденную сдачу
    if (item.isSpent === true || item.isLocked === true) continue;

    selectedItems.push(item);
    accumulatedAmount += item.coin.amount;
    if (accumulatedAmount >= requiredMojos) {
      break; 
    }
  }

  return selectedItems;
}
