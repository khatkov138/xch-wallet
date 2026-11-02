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
  xch: string;
  mojo: string;
  coin_records: any[]; // Ваша структура ChiaCoinRecord
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

export interface CoinObject {
  parent_coin_info: string;
  puzzle_hash: string;
  amount: number;
}

export interface CoinSpendPayload {
  wallet_index: number;
  message_to_sign_hex: string;
  synthetic_offset_hex: string;
  coin: CoinObject;
  puzzle_reveal: string;
  solution: string;
}

export interface TargetDisposition {
  address: string;
  puzzle_hash: string;
  amount_mojo: number;
}

export interface StandardChangeDisposition {
  wallet_index: number;
  puzzle_hash: string;
  amount_mojo: number;
}

export interface DustSplitDisposition {
  amount_per_address_mojo: number;
  total_addresses_funded: number;
  funded_indexes: number[];
}

export interface AuditInfo {
  summary: {
    total_inputs_mojo: number;
    total_outputs_mojo: number;
    fee_network_mojo: number;
    is_dust_split_applied: boolean;
  };
  disposition: {
    target: TargetDisposition;
    standard_change: StandardChangeDisposition;
    dust_split: DustSplitDisposition;
  };
}

export interface BuildSpendBundleResponse {
  success: boolean;
  integrity_token: string;
  coin_spends: CoinSpendPayload[];
  verified_target_address: string;
  verified_mojos_to_send: number;
  audit_info: AuditInfo; // 🎯 Наш новый аудит лог
}
