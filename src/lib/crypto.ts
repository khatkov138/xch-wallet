import bip39 from 'bip39';
import chiaBls from 'chia-bls';
import { sha256 } from '@noble/hashes/sha2';

// === КОНСТАНТЫ ИЗ ОКРУЖЕНИЯ .ENV ===
const CONTRACT_HEX = process.env.NEXT_PUBLIC_CONTRACT_HEX || "";
const CHIA_PORT = parseInt(process.env.NEXT_PUBLIC_CHIA_PORT || "12381", 10);
const CHIA_COIN = parseInt(process.env.NEXT_PUBLIC_CHIA_COIN || "8444", 10);
const CHARSET = process.env.NEXT_PUBLIC_CHIA_CHARSET || "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GROUP_ORDER = BigInt(process.env.NEXT_PUBLIC_CHIA_GROUP_ORDER || "0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");
const DEFAULT_HIDDEN_PUZZLE_HASH = process.env.NEXT_PUBLIC_CHIA_HIDDEN_PUZZLE_HASH || "711d6c4e32c92e53179b1994a5288a2da05bde7851007a413da9f27dda2c8ceb";

const { PrivateKey, AugSchemeMPL } = chiaBls;

const bytesToHex = (b: Uint8Array): string => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const hexToBytes = (h: string): Uint8Array => {
  const clean = h.replace(/\s+/g, '').startsWith('0x') ? h.replace(/\s+/g, '').slice(2) : h.replace(/\s+/g, '');
  const b = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) b[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  return b;
};
const bytesToBigInt = (b: Uint8Array): bigint => b.reduce((acc, v) => (acc << 8n) + BigInt(v), 0n);

function derivePath(mSk: any, path: number[]) {
  let s = mSk; for (const i of path) s = AugSchemeMPL.deriveChildSk(s, i); return s;
}

export async function encryptMnemonic(m: string, pin: string): Promise<string> {
  const enc = new TextEncoder(), pass = enc.encode(pin), hash = await crypto.subtle.digest("SHA-256", pass);
  const key = await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12)), e = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(m.trim()));
  const res = new Uint8Array(iv.length + e.byteLength); res.set(iv, 0); res.set(new Uint8Array(e), iv.length);
  return bytesToHex(res);
}

export async function decryptMnemonic(ed: string, pin: string): Promise<string> {
  let b = /^[0-9a-fA-F\s]+$/.test(ed) ? hexToBytes(ed) : new Uint8Array(Array.from(atob(ed)).map(c => c.charCodeAt(0)));
  const iv = b.slice(0, 12), data = b.slice(12), hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  const key = await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"]);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data));
}

export function deriveSyntheticSk(uSk: any, uPk: any): any {
  const pk = uPk.toBytes(), hp = hexToBytes(DEFAULT_HIDDEN_PUZZLE_HASH), c = new Uint8Array(pk.length + hp.length);
  c.set(pk, 0); c.set(hp, pk.length);
  return PrivateKey.fromHex(((bytesToBigInt(uSk.toBytes()) + bytesToBigInt(sha256(c))) % GROUP_ORDER).toString(16).padStart(64, '0'));
}

export interface CryptoAuditResult {
  mnemonic: string; master_sk_hex: string; master_pk_hex: string; fingerprint: number;
  farmer_pk_hex: string; pool_pk_hex: string; wallet_sk_hardened_hex: string; unhardened_wallet_pk_hex: string;
  contract_address: string;
}

export function runCryptoAudit(cm: string): string | null {
  try {
    const trimmed = cm.trim(), seed = bip39.mnemonicToSeedSync(trimmed), mSk = PrivateKey.fromSeed(seed);
    const wSk = derivePath(mSk, [CHIA_PORT, CHIA_COIN, 2, 0]);
    return JSON.stringify({
      mnemonic: trimmed, master_sk_hex: mSk.toHex(), master_pk_hex: mSk.getG1().toHex(), fingerprint: mSk.getG1().getFingerprint(),
      farmer_pk_hex: derivePath(mSk, [CHIA_PORT, CHIA_COIN, 0, 0]).getG1().toHex(), pool_pk_hex: derivePath(mSk, [CHIA_PORT, CHIA_COIN, 1, 0]).getG1().toHex(),
      wallet_sk_hardened_hex: wSk.toHex(), unhardened_wallet_pk_hex: bytesToHex(wSk.getG1().toBytes()),
      contract_address: getContractAddress(trimmed)
    });
  } catch (e) { return null; }
}

function convertbits(d: number[], from: number, to: number, pad: boolean): number[] | null {
  let acc = 0, bits = 0; const r: number[] = [], maxv = (1 << to) - 1, max_acc = (1 << (from + to - 1)) - 1;
  for (const v of d) {
    if (v < 0 || v >> from) return null; acc = ((acc << from) | v) & max_acc; bits += from;
    while (bits >= to) { bits -= to; r.push((acc >> bits) & maxv); }
  }
  if (pad && bits) r.push((acc << (to - bits)) & maxv); return r;
}

function bech32m(hrp: string, d: number[]): string {
  const gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; let chk = 1;
  const hrpExp = [...Array.from(hrp).map(x => x.charCodeAt(0) >> 5), 0, ...Array.from(hrp).map(x => x.charCodeAt(0) & 31)];
  for (const v of [...hrpExp, ...d, 0,0,0,0,0,0]) { const top = chk >> 25; chk = ((chk & 0x1ffffff) << 5) ^ v; for (let i=0; i<5; i++) chk ^= ((top >> i) & 1) ? gen[i] : 0; }
  chk ^= 0x2bc830a3; let res = hrp + "1"; for (const v of d) res += CHARSET[v];
  for (let i=0; i<6; i++) res += CHARSET[(chk >> (5 * (5 - i))) & 31]; return res;
}

// Канонический обход бинарного дерева Chia CLVM для расчета sha256tree
interface CLVMNode { isAtom: boolean; atom?: Uint8Array; pair?: { left: CLVMNode; right: CLVMNode } }
export function clvmTree(n: CLVMNode): Uint8Array {
  if (!n.isAtom && n.pair) {
    const l = clvmTree(n.pair.left), r = clvmTree(n.pair.right), arr = new Uint8Array(1 + l.length + r.length);
    arr[0] = 0x02; arr.set(l, 1); arr.set(r, 1 + l.length); return sha256(arr);
  }
  const atomBytes = n.atom || new Uint8Array(0);
  const arr = new Uint8Array(1 + atomBytes.length);
  arr[0] = 0x01; arr.set(atomBytes, 1); return sha256(arr);
}

export function parseCLVMBytes(bytes: Uint8Array, offset = 0): { node: CLVMNode; nextOffset: number } {
  if (bytes[offset] === 0xff) {
    const left = parseCLVMBytes(bytes, offset + 1);
    const right = parseCLVMBytes(bytes, left.nextOffset);
    return { node: { isAtom: false, pair: { left: left.node, right: right.node } }, nextOffset: right.nextOffset };
  }
  let atomOffset = offset, len = 0;
  if (bytes[atomOffset] <= 0x7f) { len = 1; }
  else if (bytes[atomOffset] === 0x80) { len = 0; atomOffset++; }
  else if (bytes[atomOffset] <= 0xb0) { len = bytes[atomOffset] - 0x80; atomOffset++; }
  else if (bytes[atomOffset] <= 0xbf) {
    const count = bytes[atomOffset] - 0xb0; atomOffset++;
    for (let i = 0; i < count; i++) { len = (len << 8) + bytes[atomOffset]; atomOffset++; }
  }
  return { node: { isAtom: true, atom: bytes.slice(atomOffset, atomOffset + len) }, nextOffset: atomOffset + len };
}

export function getContractAddress(mnemonic: string, prefix?: string): string {
  if (!CONTRACT_HEX) throw new Error("NEXT_PUBLIC_CONTRACT_HEX missing");
  const pfx = prefix || "txch";
  
  // 1. ДЕРИВАЦИЯ КЛЮЧА (Совпадает с Python m/12381/8444/2/0)
  const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
  const masterSk = PrivateKey.fromSeed(seed);
  const wSk = derivePath(masterSk, [CHIA_PORT, CHIA_COIN, 2, 0]);
  const pB = wSk.getG1().toBytes();
  
  // Читаем чистый хекс контракта из .env
  const cB = hexToBytes(CONTRACT_HEX.trim());
  
  // 2. БИНАРНАЯ СБОРКА PUZZLE REVEAL: (a (q . CONTRACT) (c (q . PUBKEY) 1))
  const prefixBytes = hexToBytes("ff02ffff01");
  const midBytes = hexToBytes("ffff04ffff01b0"); 
  const suffixBytes = hexToBytes("ff018080");

  const fullReveal = new Uint8Array(prefixBytes.length + cB.length + midBytes.length + pB.length + suffixBytes.length);
  let pos = 0;
  fullReveal.set(prefixBytes, pos); pos += prefixBytes.length;
  fullReveal.set(cB, pos); pos += cB.length;
  fullReveal.set(midBytes, pos); pos += midBytes.length;
  fullReveal.set(pB, pos); pos += pB.length;
  fullReveal.set(suffixBytes, pos);

  // 3. ПАРСИНГ И РАСЧЕТ ДЕРЕВА SHA256 (clvm_sha256tree)
  const parsedTree = parseCLVMBytes(fullReveal).node;
  const contractPuzzleHash = clvmTree(parsedTree);
  
  // =========================================================================
  // ДЕБАГ-ПРИНТЫ ДЛЯ СВЕРКИ В КОНСОЛИ БРАУЗЕРА
  // =========================================================================
  console.log("==================== CHIA CRYPTO TS DEBUG ====================");
  console.log(`🔑 Публичный ключ (48 байт):       0x${bytesToHex(pB)}`);
  console.log(`📄 Чистый скомпилированный хекс:   0x${bytesToHex(cB)}`);
  console.log(`📦 Полный байт-код Puzzle Reveal:  0x${bytesToHex(fullReveal)}`);
  console.log(`🎯 Итоговый хэш clvm_sha256tree:   0x${bytesToHex(contractPuzzleHash)}`);
  console.log("==============================================================");

  // 4. КОДИРОВАНИЕ В BECH32M АДРЕС
  const bits = convertbits(Array.from(contractPuzzleHash), 8, 5, true);
  if (!bits) throw new Error("Bit conversion failed");
  
  return bech32m(pfx, bits);
}

export function intToBytes(v: bigint): Uint8Array {
  if (v === 0n) return new Uint8Array([0]); // В CLVM 0 — это один нулевой байт или пустой атом, но в коде Chia для сумм используется [0]
  if (v < 0n) throw new Error("Negative amounts not supported");
  
  let hex = v.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  let buf = hexToBytes(hex);
  
  // ИСПРАВЛЕНО: Проверяем строго САМЫЙ ПЕРВЫЙ байт массива на наличие знакового бита!
  if (buf.length > 0 && (buf[0] & 0x80) !== 0) {
    const n = new Uint8Array(buf.length + 1);
    n.set(buf, 1); // Смещаем массив вправо, оставляя первый байт нулевым [0x00, ...]
    buf = n;
  }
  return buf;
}
export function serializeSolution(tPh: Uint8Array, sAmt: bigint, cPh: Uint8Array, cAmt: bigint) {
  const p51 = intToBytes(51n), sB = intToBytes(sAmt), cB = intToBytes(cAmt);
  
  // Канонические условия (51 target_ph amount)
  const n1: any = { isAtom: false, pair: { left: { isAtom: true, atom: p51 }, right: { isAtom: false, pair: { left: { isAtom: true, atom: tPh }, right: { isAtom: false, pair: { left: { isAtom: true, atom: sB }, right: { isAtom: true, atom: new Uint8Array(0) } } } } } } };
  const n2: any = { isAtom: false, pair: { left: { isAtom: true, atom: p51 }, right: { isAtom: false, pair: { left: { isAtom: true, atom: cPh }, right: { isAtom: false, pair: { left: { isAtom: true, atom: cB }, right: { isAtom: true, atom: new Uint8Array(0) } } } } } } };
  
  // Список условий: (n1 n2) -> То, что подписывается в AGG_SIG_ME
  const cList: any = { isAtom: false, pair: { left: n1, right: { isAtom: false, pair: { left: n2, right: { isAtom: true, atom: new Uint8Array(0) } } } } };
  
  // Финальный солюшен: ( (n1 n2) ) -> Передается в spend_bundle
  const solTree: any = { isAtom: false, pair: { left: cList, right: { isAtom: true, atom: new Uint8Array(0) } } };
  
  const serN = (n: any): Uint8Array => {
    if (!n.isAtom && n.pair) {
      const l = serN(n.pair.left), r = serN(n.pair.right), res = new Uint8Array(1 + l.length + r.length);
      res[0] = 0xff; res.set(l, 1); res.set(r, 1 + l.length); return res;
    }
    const atom = n.atom || new Uint8Array(0);
    if (atom.length === 0) return new Uint8Array([0x80]);
    if (atom.length === 1 && atom[0] <= 0x7f) return new Uint8Array([atom[0]]);
    const res = new Uint8Array(1 + atom.length); res[0] = 0x80 + atom.length; res.set(atom, 1); return res;
  };

  return {
    solutionHex: bytesToHex(serN(solTree)),
    // Считаем хэш дерева условий ПРЯМО ТУТ, до сериализации солюшена
    conditionsHash: clvmTree(cList) 
  };
}
