import chiaBls from "chia-bls"
import { sha256 } from '@noble/hashes/sha2';

const { PrivateKey, AugSchemeMPL } = chiaBls;
const GROUP_ORDER = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;
const DEFAULT_HIDDEN_PUZZLE_HASH = "711d6c4e32a7927e0bc23210773424255a3085549018e42e31efb3c52308a12d";

export const toBytes = (h: string): Uint8Array => {
  const c = h.replace(/^0x|\s+/g, '').toLowerCase();
  return new Uint8Array(c.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
};

export const toHex = (b: Uint8Array): string => 
  Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');

function bytesToBigInt(b: Uint8Array): bigint {
  return b.reduce((acc, v) => (acc << 8n) + BigInt(v), 0n);
}

interface CreateSpendBundleParams {
  walletPrivateKeyHex: string;
  msgHex: string;
  coinSpend: any;
}

export function createChiaSpendBundle({ walletPrivateKeyHex, msgHex, coinSpend }: CreateSpendBundleParams) {
  if (!walletPrivateKeyHex || !msgHex || !coinSpend) {
    throw new Error("Недостаточно данных для создания SpendBundle");
  }

  const targetSk = PrivateKey.fromBytes(toBytes(walletPrivateKeyHex));
  const msgBytes = toBytes(msgHex);

  const pkBytes = targetSk.getG1().toBytes();
  const hp = toBytes(DEFAULT_HIDDEN_PUZZLE_HASH);
  const c = new Uint8Array(pkBytes.length + hp.length);
  c.set(pkBytes, 0); c.set(hp, pkBytes.length);
  const hashStep = sha256(c);

  //# 🔥 КРИТИЧЕСКИЙ ФИКС: Используем канонический keyGen вместо fromSeed
  //# В библиотеке chia-bls генерация ключа из сида по спецификации Chia делается через AugSchemeMPL.keyGen()
  const hiddenSecretKey = AugSchemeMPL.keyGen(hashStep);

  const targetSkBigInt = bytesToBigInt(targetSk.toBytes());
  const hiddenSkBigInt = bytesToBigInt(hiddenSecretKey.toBytes());

  const syntheticSkBigInt = (targetSkBigInt + hiddenSkBigInt) % GROUP_ORDER;
  
  const syntheticSkHex = syntheticSkBigInt.toString(16).padStart(64, '0');
  const syntheticSecretKey = PrivateKey.fromHex(syntheticSkHex);

  const signature = AugSchemeMPL.sign(syntheticSecretKey, msgBytes);
  const aggregatedSignatureHex = "0x" + toHex(signature.toBytes());

  return {
    coin_spends: [coinSpend],
    aggregated_signature: aggregatedSignatureHex
  };
}
