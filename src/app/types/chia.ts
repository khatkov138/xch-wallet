// Единственное место описания структуры транзакции для фронтенда
export interface CleanTransaction {
  name: string;
  to_address: string;
  amount: number;
  confirmed_at_time: number;
  type: number;
}

// Единственное место описания баланса
export interface BalanceData {
  xch: number;
  mojo: number;
  coin_records: unknown[];
}

// Общие переиспользуемые хелперы форматирования данных
export const formatAddress = (address: string): string => {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const formatDate = (timestamp: number): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const realMonths = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${date.getDate()} ${realMonths[date.getMonth()]} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
