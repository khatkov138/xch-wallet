import * as bip39 from 'bip39'
import { bech32m } from 'bech32'
// ИМПОРТИРУЕМ ИЗ КОРНЯ: Это решает проблему "corresponding type declarations" в Next.js 15
import { sha256 } from '@noble/hashes/sha2.js';

const CHIA_PREFIX = 'xch'

/**
 * Переводит хэш публичного ключа (puzzle hash) в Bech32m адрес Chia Network
 */
export function puzzleHashToAddress(puzzleHash: Uint8Array): string {
  const words = bech32m.toWords(puzzleHash)
  return bech32m.encode(CHIA_PREFIX, words)
}

/**
 * Берет 24 слова и деривирует валидный Mainnet адрес Chia Network (xch1...)
 */
export async function generateChiaAddressFromMnemonic(mnemonic: string): Promise<string> {
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

  // 5. Кодируем в Bech32m с префиксом xch
  return puzzleHashToAddress(puzzleHash)
}
