import * as bip39 from 'bip39'
// Импортируем оба кодировщика для гибкой обратной совместимости
import { bech32, bech32m } from 'bech32'
// ИМПОРТИРУЕМ ИЗ КОРНЯ: Это решает проблему "corresponding type declarations" в Next.js 15
import { sha256 } from '@noble/hashes/sha2.js';

const CHIA_MAINNET_PREFIX = 'xch'
const CHIA_TESTNET_PREFIX = 'txch'

/**
 * Переводит хэш публичного ключа (puzzle hash) в Bech32m адрес Chia Network
 * ФИКС: Для кранов и Mainnet/Testnet всегда используем кодирование bech32m
 */
export function puzzleHashToAddress(puzzleHash: Uint8Array, prefix: string = CHIA_MAINNET_PREFIX): string {
  const words = bech32m.toWords(puzzleHash)
  // Всегда кодируем в bech32m, чтобы у адреса txch1... была правильная чексума для веб-кранов
  return bech32m.encode(prefix, words, 100)
}

/**
 * Берет 24 слова и деривирует валидный адрес Chia Network.
 * @param mnemonic 24 слова сид-фразы
 * @param isTestnet Флаг переключения на тестовую сеть. Если true — вернет адрес txch1...
 */
export async function generateChiaAddressFromMnemonic(mnemonic: string, isTestnet: boolean = false): Promise<string> {
  // 1. Проверяем фразу на валидность по словарю BIP-39
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase')
  }

  // 2. Генерируем 64-байтный бинарный сид (bip39 возвращает Node.js Buffer)
  const seedBuffer = await bip39.mnemonicToSeed(mnemonic)

  // 3. Безопасное приведение типов: переводим Node Buffer в чистый Uint8Array для браузера
  const cleanSeedBytes = new Uint8Array(
    seedBuffer.buffer,
    seedBuffer.byteOffset,
    seedBuffer.byteLength
  )

  // 4. Вычисляем хэши через стабильный корневой импорт @noble/hashes
  const masterKey = sha256(cleanSeedBytes)
  const puzzleHash = sha256(masterKey)

  // 5. Определяем префикс в зависимости от выбранной сети и кодируем в Bech32m
  const activePrefix = isTestnet ? CHIA_TESTNET_PREFIX : CHIA_MAINNET_PREFIX
  return puzzleHashToAddress(puzzleHash, activePrefix)
}

/**
 * Универсальный декодер: переводит адрес в hex-строку puzzle_hash.
 * Автоматически подбирает нужный стандарт чексумы (bech32 или bech32m).
 */
export function addressToPuzzleHash(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new Error("Адрес должен быть текстовой строкой")
  }

  const cleanAddress = address.trim()

  // Попытка 1: Пробуем декодировать как Bech32m (Стандарт для веб-приложений и Mainnet)
  try {
    const decoded = bech32m.decode(cleanAddress, 100)
    if (decoded.prefix === CHIA_MAINNET_PREFIX || decoded.prefix === CHIA_TESTNET_PREFIX) {
      const words = bech32m.fromWords(decoded.words)
      return Buffer.from(words).toString("hex")
    }
  } catch (e) {
    // Если упало с ошибкой чексумы — игнорируем и пробуем старый формат ниже
  }

  // Попытка 2: Пробуем декодировать как старый Bech32 (Формат локального CLI кошелька Chia)
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
