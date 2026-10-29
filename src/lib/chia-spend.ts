import chiaBls from "chia-bls"

const { PrivateKey, AugSchemeMPL } = chiaBls;

export const toBytes = (h: string): Uint8Array => {
  const c = h.replace(/^0x|\s+/g, '').toLowerCase();
  return new Uint8Array(c.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
};

export const toHex = (b: Uint8Array): string => 
  Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');

interface CreateSpendBundleParams {
  walletPrivateKeyHex: string;
  msgHex: string;
  coinSpend: any;
}

/**
 * Локально подписывает хеш транзакции и собирает готовый SpendBundle для сети Chia
 */
export function createChiaSpendBundle({ walletPrivateKeyHex, msgHex, coinSpend }: CreateSpendBundleParams) {
  if (!walletPrivateKeyHex || !msgHex || !coinSpend) {
    throw new Error("Недостаточно данных для создания SpendBundle");
  }

  const sk = PrivateKey.fromBytes(toBytes(walletPrivateKeyHex));
  const msgBytes = toBytes(msgHex);

  // BLS подпись контракта
  const signature = AugSchemeMPL.sign(sk, msgBytes);
  const aggregatedSignatureHex = "0x" + toHex(signature.toBytes());

  return {
    coin_spends: [coinSpend],
    aggregated_signature: aggregatedSignatureHex
  };
}
