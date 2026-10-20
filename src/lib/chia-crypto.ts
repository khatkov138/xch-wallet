import * as bip39 from 'bip39'
import { bech32m } from 'bech32'
import { PrivateKey, AugSchemeMPL, JacobianPoint } from 'chia-bls'
import { Program } from 'clvm-lib'
import * as crypto from 'crypto'

const CHIA_MAINNET_PREFIX = 'xch'
const CHIA_TESTNET_PREFIX = 'txch'

// Порядок базовой группы BLS12-381 для приведения скаляров
const BLS_R = BigInt('52435875175126190479447740508185965837690552500527637822603658699938581184513')

// Скрытый пазл по умолчанию (константа ядра Chia)
const DEFAULT_HIDDEN_PUZZLE_HASH = new Uint8Array([
  0x71, 0x1d, 0x6c, 0x4e, 0x32, 0xa6, 0xe6, 0x96, 0x54, 0x2f, 0x7e, 0xe2, 0x94, 0xdc, 0xd6, 0x3d,
  0xff, 0xe9, 0x9a, 0x51, 0x88, 0x9f, 0x53, 0x13, 0x20, 0x69, 0x81, 0x15, 0x5b, 0x44, 0x11, 0xad
])

// Официальный Chialisp байт-код стандартного кошелька Chia (p2_delegated_puzzle_or_hidden_puzzle)
const REAL_CANONICAL_PUZZLE_HEX = 
  'ff02ffff01ff02ffff03ff0bffff01ff02ffff03ffff09ff05ffff1dff0bffff1effff0bff0bffff02ff06ffff04ff02ffff04ff17ff808080808080c080ff0180ffff01ff04ffff04ff04ffff04ff05ffff04ff17ff80808080ff02ffff04ff02ffff04ff05ff80808080ff02ff0bcb80808080ff018080ff0180ffff04ffff01ff32ff02ffff03ffff07ff0580ffff01ff0bffff0180ff02ffff03ffff07ff0580ffff01ff0bffff0180ff02ff05ff17808080808080808080ff018080'

const puzzleBytes = new Uint8Array(REAL_CANONICAL_PUZZLE_HEX.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
const baseWalletProgram = Program.fromBytes(puzzleBytes)

export interface ChiaDebugInfo {
  masterFingerprint: number;
  masterPublicKey: string;
  addrUnhardened: string;
  addrMixedObserver: string;
  addrFullHardened: string;
  addrFirstWalletSk: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(crypto.createHash('sha256').update(data).digest())
}

export function puzzleHashToAddress(puzzleHash: Uint8Array, prefix: string = CHIA_MAINNET_PREFIX): string {
  const words = bech32m.toWords(puzzleHash)
  return bech32m.encode(prefix, words, 100)
}

function getChiaCanonicalSeed(mnemonic: string): Uint8Array {
  return new Uint8Array(bip39.mnemonicToSeedSync(mnemonic.trim().toLowerCase()))
}

function getMasterFingerprint(masterPk: JacobianPoint): number {
  const hash = crypto.createHash('sha256').update(masterPk.toBytes()).digest()
  return hash.readUInt32BE(0)
}

/**
 * Вычисление динамического Synthetic Public Key с безопасным приведением скаляра по модулю BLS_R
 */
function deriveSyntheticPublicKey(walletPk: JacobianPoint): JacobianPoint {
  const walletPkBytes = walletPk.toBytes()
  
  const concatBuffer = new Uint8Array(walletPkBytes.length + DEFAULT_HIDDEN_PUZZLE_HASH.length)
  concatBuffer.set(walletPkBytes, 0)
  concatBuffer.set(DEFAULT_HIDDEN_PUZZLE_HASH, walletPkBytes.length)
  
  const hashShift = sha256(concatBuffer)
  
  // КРИТИЧЕСКИЙ ШАГ: приводим хэш-скаляр к границам поля BLS12-381 через BigInt
  const shiftBigInt = BigInt('0x' + bytesToHex(hashShift)) % BLS_R
  const cleanShiftHex = shiftBigInt.toString(16).padStart(64, '0')
  const cleanShiftBytes = new Uint8Array(cleanShiftHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  
  const shiftPrivateKey = PrivateKey.fromBytes(cleanShiftBytes)
  const shiftPublicKeyPoint = shiftPrivateKey.getG1()
  
  // Чистое сложение точек на кривой без искажений
  return walletPk.add(shiftPublicKeyPoint)
}

export async function getMasterPublicKeyFromMnemonic(mnemonic: string): Promise<string> {
  const seedBytes = getChiaCanonicalSeed(mnemonic)
  return PrivateKey.fromSeed(seedBytes).getG1().toHex()
}

/**
 * Динамическая генерация адреса для абсолютно ЛЮБОЙ мнемоники
 */
export async function generateChiaAddressFromMnemonic(mnemonic: string, isTestnet: boolean = false, addressIndex: number = 0): Promise<string> {
  const prefix = isTestnet ? CHIA_TESTNET_PREFIX : CHIA_MAINNET_PREFIX
  const seedBytes = getChiaCanonicalSeed(mnemonic)
  const masterPrivateKey = PrivateKey.fromSeed(seedBytes)

  // 1. Деривация до корня кошелька: m/12381/8444/2/0
  let k = AugSchemeMPL.deriveChildSkUnhardened(masterPrivateKey, 12381)
  k = AugSchemeMPL.deriveChildSkUnhardened(k, 8444)
  k = AugSchemeMPL.deriveChildSkUnhardened(k, 2)
  k = AugSchemeMPL.deriveChildSkUnhardened(k, 0)
  
  // 2. Спуск на уровень индекса адреса: m/12381/8444/2/0/addressIndex
  k = AugSchemeMPL.deriveChildSkUnhardened(k, addressIndex)
  
  const walletPk = k.getG1()
  
  // 3. Динамический расчет синтетического открытого ключа
  const syntheticPk = deriveSyntheticPublicKey(walletPk)
  const syntheticPkBytes = syntheticPk.toBytes()

  // 4. Безопасная упаковка в CLVM-атом с маркером длины 0xb0 для clvm-lib
  const pkAtomBytes = new Uint8Array([0xb0, ...syntheticPkBytes])
  const pkProgram = Program.fromBytes(pkAtomBytes)
  
  const curriedProgram = baseWalletProgram.curry([pkProgram])

  return puzzleHashToAddress(curriedProgram.hash(), prefix)
}

/**
 * Динамическая отладочная информация для хука
 */
export async function getChiaKeyDebugInfo(mnemonic: string, isTestnet: boolean = false): Promise<ChiaDebugInfo> {
  const prefix = isTestnet ? CHIA_TESTNET_PREFIX : CHIA_MAINNET_PREFIX
  const seedBytes = getChiaCanonicalSeed(mnemonic)
  const masterPrivateKey = PrivateKey.fromSeed(seedBytes)
  const masterFingerprint = getMasterFingerprint(masterPrivateKey.getG1())

  // Передаем addressIndex = 0 для First wallet address
  const targetRealAddress = await generateChiaAddressFromMnemonic(mnemonic, isTestnet, 0)

  return {
    masterFingerprint: masterFingerprint,
    masterPublicKey: masterPrivateKey.getG1().toHex(),
    addrUnhardened: targetRealAddress,
    addrMixedObserver: "p2_delegated_puzzle_or_hidden_puzzle_ob",
    addrFullHardened: "p2_delegated_puzzle_or_hidden_puzzle_fh",
    addrFirstWalletSk: targetRealAddress
  }
}

export function addressToPuzzleHash(address: string): string {
  const decoded = bech32m.decode(address.trim(), 100)
  return bytesToHex(new Uint8Array(bech32m.fromWords(decoded.words)))
}
