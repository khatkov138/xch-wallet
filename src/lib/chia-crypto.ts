import * as bip39 from 'bip39'
// Импортируем оба кодировщика для гибкой обратной совместимости
import { bech32, bech32m } from 'bech32'
// Используем официальные классы криптографии Chia для ключей и деривации
import { PrivateKey, AugSchemeMPL } from 'chia-bls'
// Используем встроенный в Node.js / Next.js модуль crypto для безопасного SHA-256
import crypto from 'crypto'

const CHIA_MAINNET_PREFIX = 'xch'
const CHIA_TESTNET_PREFIX = 'txch'

/**
 * Переводит хэш публичного ключа (puzzle hash) в Bech32m адрес Chia Network
 * Всегда кодируем в bech32m, чтобы у адреса была правильная чексума для блокчейна и кранов
 */
export function puzzleHashToAddress(puzzleHash: Uint8Array, prefix: string = CHIA_MAINNET_PREFIX): string {
  const words = bech32m.toWords(puzzleHash)
  return bech32m.encode(prefix, words, 100)
}

/**
 * Генерирует легитимный Master Public Key (m) для крана.
 * Возвращает каноничную 96-символьную hex-строку (48 байт), которую бэкенд крана принимает без ошибок.
 */
export async function getMasterPublicKeyFromMnemonic(mnemonic: string): Promise<string> {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase')
  }

  // 1. Получаем бинарный сид из 24 слов
  const seedBuffer = await bip39.mnemonicToSeed(mnemonic)
  const cleanSeedBytes = new Uint8Array(seedBuffer)

  // 2. Генерируем оригинальный приватный ключ Chia из сида
  const masterPrivateKey = PrivateKey.fromSeed(cleanSeedBytes)

  // 3. Извлекаем точку G1 (настоящий Master Public Key)
  const masterPublicKey = masterPrivateKey.getG1()

  // 4. Переводим в hex-строку для использования на сайте крана
  return masterPublicKey.toHex()
}

/**
 * ГЕНЕРАЦИЯ НАСТОЯЩЕГО АДРЕСА CHIA (ФИКС ОШИБКИ ТИПОВ)
 * Шагает по официальному пути кошелька Chia (m/12381/8444/2/0) и делает из него адрес.
 * @param mnemonic 24 слова сид-фразы
 * @param isTestnet Флаг тестовой сети. Если true — вернет адрес с префиксом txch1...
 */
export async function generateChiaAddressFromMnemonic(mnemonic: string, isTestnet: boolean = false): Promise<string> {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase')
  }

  const seedBuffer = await bip39.mnemonicToSeed(mnemonic)
  const cleanSeedBytes = new Uint8Array(seedBuffer)
  const masterPrivateKey = PrivateKey.fromSeed(cleanSeedBytes)

  // Официальный путь деривации кошелька Chia: m/12381/8444/2/0
  let derivedKey = AugSchemeMPL.deriveChildSk(masterPrivateKey, 12381)
  derivedKey = AugSchemeMPL.deriveChildSk(derivedKey, 8444)
  derivedKey = AugSchemeMPL.deriveChildSk(derivedKey, 2)
  derivedKey = AugSchemeMPL.deriveChildSkUnhardened(derivedKey, 0) // Первый публичный адрес

  const walletPublicKey = derivedKey.getG1()

  // ФИКС: Берем байты публичного ключа через .toBytes() и хэшируем через встроенный crypto.createHash
  const publicKeyBytes = walletPublicKey.toBytes()
  const hashBuffer = crypto.createHash('sha256').update(publicKeyBytes).digest()
  const puzzleHash = new Uint8Array(hashBuffer)

  const activePrefix = isTestnet ? CHIA_TESTNET_PREFIX : CHIA_MAINNET_PREFIX
  return puzzleHashToAddress(puzzleHash, activePrefix)
}

/**
 * Универсальный декодер: переводит текстовый адрес в hex-строку puzzle_hash.
 * Автоматически подбирает нужный стандарт чексумы (bech32 или bech32m).
 */
export function addressToPuzzleHash(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new Error("Адрес должен быть текстовой строкой")
  }

  const cleanAddress = address.trim()

  // Попытка 1: Декодируем как Bech32m (Стандарт для веб-приложений, кранов и Mainnet)
  try {
    const decoded = bech32m.decode(cleanAddress, 100)
    if (decoded.prefix === CHIA_MAINNET_PREFIX || decoded.prefix === CHIA_TESTNET_PREFIX) {
      const words = bech32m.fromWords(decoded.words)
      return Buffer.from(words).toString("hex")
    }
  } catch (e) {
    // Ошибку игнорируем, пробуем старый формат
  }

  // Попытка 2: Декодируем как старый Bech32 (Формат локального CLI кошелька Chia)
  try {
    const decoded = bech32.decode(cleanAddress, 100)
    if (decoded.prefix === CHIA_MAINNET_PREFIX || decoded.prefix === CHIA_TESTNET_PREFIX) {
      const words = bech32.fromWords(decoded.words)
      return Buffer.from(words).toString("hex")
    }
  } catch (error: any) {
    throw new Error(`Ошибка декодирования адреса (Bech32/Bech32m): ${error.message}`)
  }

  throw new Error("Неверный префикс сети. Должен быть xch или txch")
}
