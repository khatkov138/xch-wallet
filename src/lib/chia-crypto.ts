import * as bip39 from 'bip39'
import { bech32m } from 'bech32'
import { PrivateKey, AugSchemeMPL, JacobianPoint } from 'chia-bls'
import { Program } from 'clvm-lib'
import * as crypto from 'crypto'

const CHIA_MAINNET_PREFIX = 'xch'
const CHIA_TESTNET_PREFIX = 'txch'

// Порядок базовой группы BLS12-381 для математики скаляров приватных ключей
const BLS_R = BigInt('52435875175126190479447740508185965837690552500527637822603658699938581184513')

// Скрытый пазл Chia по умолчанию
const DEFAULT_HIDDEN_PUZZLE_HASH = new Uint8Array([
  0x71, 0x1d, 0x6c, 0x4e, 0x32, 0xa6, 0xe6, 0x96, 0x54, 0x2f, 0x7e, 0xe2, 0x94, 0xdc, 0xd6, 0x3d,
  0xff, 0xe9, 0x9a, 0x51, 0x88, 0x9f, 0x53, 0x13, 0x20, 0x69, 0x81, 0x15, 0x5b, 0x44, 0x11, 0xad
])

// Канонический байт-код стандартного кошелька Chia (p2_delegated_puzzle_or_hidden_puzzle)
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
  return bech32m.encode(prefix, words, Infinity)
}

function getChiaCanonicalSeed(mnemonic: string): Uint8Array {
  return new Uint8Array(bip39.mnemonicToSeedSync(mnemonic.trim().toLowerCase()))
}

function getMasterFingerprint(masterPk: JacobianPoint): number {
  const hash = crypto.createHash('sha256').update(masterPk.toBytes()).digest()
  return hash.readUInt32BE(0)
}

/**
 * Истинный расчет каноничного Synthetic Public Key через скаляры
 */
function deriveSyntheticPublicKey(walletSk: PrivateKey): JacobianPoint {
  const walletPkBytes = walletSk.getG1().toBytes()
  
  const concatBuffer = new Uint8Array(walletPkBytes.length + DEFAULT_HIDDEN_PUZZLE_HASH.length)
  concatBuffer.set(walletPkBytes, 0)
  concatBuffer.set(DEFAULT_HIDDEN_PUZZLE_HASH, walletPkBytes.length)
  
  const hashShift = sha256(concatBuffer)
  
  const walletSkBigInt = BigInt('0x' + bytesToHex(walletSk.toBytes()))
  const shiftBigInt = BigInt('0x' + bytesToHex(hashShift))
  
  const syntheticSkBigInt = (walletSkBigInt + shiftBigInt) % BLS_R
  const syntheticSkHex = syntheticSkBigInt.toString(16).padStart(64, '0')
  const syntheticSkBytes = new Uint8Array(syntheticSkHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  
  return PrivateKey.fromBytes(syntheticSkBytes).getG1()
}

export async function getMasterPublicKeyFromMnemonic(mnemonic: string): Promise<string> {
  const seedBytes = getChiaCanonicalSeed(mnemonic)
  return PrivateKey.fromSeed(seedBytes).getG1().toHex()
}

/**
 * ПОЛНОСТЬЮ ДИНАМИЧЕСКАЯ ГЕНЕРАЦИЯ АДРЕСА ПО ИСТИННОМУ ПУТИ CLI (m/12381/8444/2/0)
 */
export async function generateChiaAddressFromMnemonic(mnemonic: string, isTestnet: boolean = false): Promise<string> {
  const prefix = isTestnet ? CHIA_TESTNET_PREFIX : CHIA_MAINNET_PREFIX
  const seedBytes = getChiaCanonicalSeed(mnemonic)
  const masterPrivateKey = PrivateKey.fromSeed(seedBytes)

  // 1. Истинная Unhardened деривация кошелька, которая дает 6a64b366...
  let k = AugSchemeMPL.deriveChildSkUnhardened(masterPrivateKey, 12381)
  k = AugSchemeMPL.deriveChildSkUnhardened(k, 8444)
  k = AugSchemeMPL.deriveChildSkUnhardened(k, 2)
  k = AugSchemeMPL.deriveChildSkUnhardened(k, 0)
  
  // 2. Считаем каноничную точку синтетического открытого ключа прямо от корня кошелька
  const syntheticPk = deriveSyntheticPublicKey(k)

  // 3. Передаем в clvm-lib чистый Hex сжатого ключа без префиксов
  const cleanHex = syntheticPk.toHex().replace(/^0x/, '')
  const pkProgram = Program.fromHex(cleanHex)
  
  const curriedProgram = baseWalletProgram.curry([pkProgram])
  return puzzleHashToAddress(curriedProgram.hash(), prefix)
}

/**
 * МАКСИМАЛЬНЫЙ СТЕНД ЛОГИРОВАНИЯ — СВЕРКА С ТЕРМИНАЛОМ (ПОЛНОСТЬЮ UNHARDENED)
 */
export async function getChiaKeyDebugInfo(mnemonic: string, isTestnet: boolean = false): Promise<ChiaDebugInfo> {
  const prefix = isTestnet ? CHIA_TESTNET_PREFIX : CHIA_MAINNET_PREFIX
  const seedBytes = getChiaCanonicalSeed(mnemonic)
  
  const masterPrivateKey = PrivateKey.fromSeed(seedBytes)
  const masterPk = masterPrivateKey.getG1()
  const masterFingerprint = getMasterFingerprint(masterPk)

  // Деривация Farmer Keys (m/12381/8444/0/0) через чистый Unhardened путь
  let farmerSk = AugSchemeMPL.deriveChildSkUnhardened(masterPrivateKey, 12381)
  farmerSk = AugSchemeMPL.deriveChildSkUnhardened(farmerSk, 8444)
  farmerSk = AugSchemeMPL.deriveChildSkUnhardened(farmerSk, 0)
  farmerSk = AugSchemeMPL.deriveChildSkUnhardened(farmerSk, 0)

  // Деривация Pool Keys (m/12381/8444/1/0) через чистый Unhardened путь
  let poolSk = AugSchemeMPL.deriveChildSkUnhardened(masterPrivateKey, 12381)
  poolSk = AugSchemeMPL.deriveChildSkUnhardened(poolSk, 8444)
  poolSk = AugSchemeMPL.deriveChildSkUnhardened(poolSk, 1)
  poolSk = AugSchemeMPL.deriveChildSkUnhardened(poolSk, 0)

  // Деривация First Wallet Secret Key (m/12381/8444/2/0) через чистый Unhardened путь
  let walletSk = AugSchemeMPL.deriveChildSkUnhardened(masterPrivateKey, 12381)
  walletSk = AugSchemeMPL.deriveChildSkUnhardened(walletSk, 8444)
  walletSk = AugSchemeMPL.deriveChildSkUnhardened(walletSk, 2)
  walletSk = AugSchemeMPL.deriveChildSkUnhardened(walletSk, 0)

  const targetRealAddress = await generateChiaAddressFromMnemonic(mnemonic, isTestnet)

  console.log("%c PS C:\\Users\\khatk> chia keys show --show-mnemonic-seed ", "background: #0c0a09; color: #a1a1aa; font-family: monospace; padding: 4px; display: block; width: 100%;")
  console.log("%c Showing all public and private keys ", "color: #f4f4f5; font-family: monospace;")
  console.log(`\nLabel: 1`)
  console.log(`Fingerprint: ${masterFingerprint}`)
  console.log(`Master public key (m): ${masterPk.toHex()}`)
  console.log(`Farmer public key (m/12381/8444/0/0): ${farmerSk.getG1().toHex()}`)
  console.log(`Pool public key (m/12381/8444/1/0): ${poolSk.getG1().toHex()}`)
  console.log(`%cFirst wallet address: ${targetRealAddress}`, "color: #34d399; font-weight: bold;")
  console.log(`Master private key (m): ${bytesToHex(masterPrivateKey.toBytes())}`)
  console.log(`Farmer private key (m/12381/8444/0/0): ${bytesToHex(farmerSk.toBytes())}`)
  console.log(`First wallet secret key (m/12381/8444/2/0): ${bytesToHex(walletSk.toBytes())}`)
  console.log(`  Mnemonic seed (24 secret words):\n  ${mnemonic}`)
  console.log("%c -------------------------------------------------------------------------------- ", "color: #3f3f46;")

  return {
    masterFingerprint: masterFingerprint,
    masterPublicKey: masterPk.toHex(),
    addrUnhardened: targetRealAddress,
    addrMixedObserver: "p2_delegated_puzzle_or_hidden_puzzle_ob",
    addrFullHardened: "p2_delegated_puzzle_or_hidden_puzzle_fh",
    addrFirstWalletSk: targetRealAddress
  }
}

export function addressToPuzzleHash(address: string): string {
  const decoded = bech32m.decode(address.trim(), Infinity)
  return bytesToHex(new Uint8Array(bech32m.fromWords(decoded.words)))
}
