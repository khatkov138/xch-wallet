import bip39 from 'bip39'
import chiaBls from 'chia-bls'
import { sha256 } from '@noble/hashes/sha256'

const { PrivateKey, AugSchemeMPL } = chiaBls

const CHIA_PORT = 12381
const CHIA_COIN = 8444

// Криптографические константы Chia Network
const GROUP_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001")
const DEFAULT_HIDDEN_PUZZLE_HASH = "711d6c4e32c92e53179b1994a5288a2da05bde7851007a413da9f27dda2c8ceb"

// =========================================================================
// ВНУТРЕННИЕ ХЕЛПЕРЫ ДЛЯ РАБОТЫ С БАЙТАМИ И СТРОКАМИ
// =========================================================================
const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

const hexToBytes = (hex: string): Uint8Array => {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  return bytes.reduce((acc, val) => (acc << 8n) + BigInt(val), 0n)
}




// 2. Сами функции деривации переводим на BasicSchemeMPL:
function derivePath(masterSk: any, path: number[]) {
  let currentSk = masterSk
  for (const index of path) {
    currentSk = AugSchemeMPL.deriveChildSk(currentSk, index)
  }
  return currentSk
}

function derivePathUnhardened(masterSk: any, path: number[]) {
  let currentSk = masterSk
  for (const index of path) {
    currentSk = AugSchemeMPL.deriveChildSkUnhardened(currentSk, index)
  }
  return currentSk
}

// =========================================================================
// 1. НАДЁЖНОЕ ШИФРОВАНИЕ МНЕМОНИКИ (WEB CRYPTO API + HEX)
// =========================================================================

/**
 * Зашифровывает мнемонику с помощью ПИН-кода (AES-GCM) и возвращает Hex-строку.
 */export async function encryptMnemonic(mnemonic: string, pin: string): Promise<string> {
  try {
    const textEncoder = new TextEncoder()
    const passwordBuffer = textEncoder.encode(pin)

    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer)
    const key = await crypto.subtle.importKey(
      "raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt"]
    )

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, textEncoder.encode(mnemonic.trim())
    )

    const resultBuffer = new Uint8Array(iv.length + encrypted.byteLength)
    resultBuffer.set(iv, 0)
    resultBuffer.set(new Uint8Array(encrypted), iv.length)

    return bytesToHex(resultBuffer)
  } catch (e) {
    console.error("Encryption failed", e)
    throw new Error("Ошибка шифрования данных")
  }
}

/**
 * Дешифрует мнемонику из любого формата (Hex или старый Base64) с помощью ПИН-кода.
 */
export async function decryptMnemonic(encryptedData: string, pin: string): Promise<string> {
  try {
    const textDecoder = new TextDecoder()
    let buffer: Uint8Array

    // ПРОВЕРКА ФОРМАТА: Если строка состоит только из hex-символов и имеет четную длину — это Hex
    const isHex = /^[0-9a-fA-F]+$/.test(encryptedData) && encryptedData.length % 2 === 0

    if (isHex) {
      // Новый формат
      buffer = hexToBytes(encryptedData)
    } else {
      // СТАРЫЙ формат (Base64), который у тебя сейчас лежит в localStorage
      const binaryString = atob(encryptedData)
      buffer = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i)
      }
    }

    const iv = buffer.slice(0, 12)
    const data = buffer.slice(12)

    const passwordBuffer = new TextEncoder().encode(pin)
    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer)

    const key = await crypto.subtle.importKey(
      "raw", hashBuffer, { name: "AES-GCM" }, false, ["decrypt"]
    )

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)

    // Если это была старая Base64 запись, автоматически перезапишем её в надежный Hex при следующем входе
    const decryptedText = textDecoder.decode(decrypted)
    return decryptedText
  } catch (e) {
    console.error("Decryption failed", e)
    throw new Error("Неверный ПИН-код")
  }
}

// =========================================================================
// 2. ДЕРИВАЦИЯ СИНТЕТИЧЕСКИХ КЛЮЧЕЙ CHIA NETWORK
// =========================================================================

/**
 * Каноническая деривация синтетического приватного ключа Chia Network (CHIP-0002)
 */export function deriveSyntheticSk(unhardenedWalletSk: any, unhardenedWalletPk: any): any {
  // 1. Получаем сжатые байты публичного ключа (48 байт)
  const pkBytes = unhardenedWalletPk.toBytes()
  const hiddenPuzzleBytes = hexToBytes(DEFAULT_HIDDEN_PUZZLE_HASH)

  // 2. Сборка буфера для твика
  const concatBuffer = new Uint8Array(pkBytes.length + hiddenPuzzleBytes.length)
  concatBuffer.set(pkBytes, 0)
  concatBuffer.set(hiddenPuzzleBytes, pkBytes.length)

  const tweakHash = sha256(concatBuffer)
  const tweakBigInt = bytesToBigInt(tweakHash)

  // ИСПРАВЛЕНО: Извлекаем сырые байты приватного ключа БЕЗ .toHex(), 
  // чтобы исключить внутренний переворот байт библиотекой (Little-Endian коллизии)
  const skBytes = unhardenedWalletSk.toBytes()
  const walletSkBigInt = bytesToBigInt(skBytes)

  // 3. Сложение по модулю r
  const syntheticSkBigInt = (walletSkBigInt + tweakBigInt) % GROUP_ORDER

  const syntheticSkHex = syntheticSkBigInt.toString(16).padStart(64, '0')
  const syntheticSk = PrivateKey.fromHex(syntheticSkHex)

  console.log("🚀 СИНХРОНИЗИРОВАННЫЙ СЖАТЫЙ SYNTHETIC PK HEX:", syntheticSk.getG1().toHex())

  return syntheticSk
}
// =========================================================================
// 3. ЭКСПОРТИРУЕМЫЕ МЕТОДЫ ДЛЯ КРИПТО-АУДИТА И ПОДПИСИ
// =========================================================================

/**
 * Полный аудит ключей кошелька Chia с выводом в консоль фронтенда.
 * Возвращает unhardened_wallet_pk_hex для бэкенда.
 */
export function runCryptoAudit(clearMnemonic: string): string | null {
  try {
    const seed = bip39.mnemonicToSeedSync(clearMnemonic.trim())
    const master_sk = PrivateKey.fromSeed(seed)
    const master_sk_hex = master_sk.toHex()

    const master_pk = master_sk.getG1()
    const master_pk_hex = master_pk.toHex()
    const fingerprint = master_pk.getFingerprint()

    const farmer_sk = derivePath(master_sk, [CHIA_PORT, CHIA_COIN, 0, 0])
    const farmer_pk_hex = farmer_sk.getG1().toHex()

    const pool_sk = derivePath(master_sk, [CHIA_PORT, CHIA_COIN, 1, 0])
    const pool_pk_hex = pool_sk.getG1().toHex()

    const wallet_sk = derivePath(master_sk, [CHIA_PORT, CHIA_COIN, 2, 0])
    const wallet_sk_hex = wallet_sk.toHex()

    const unhardened_wallet_sk = derivePathUnhardened(master_sk, [CHIA_PORT, CHIA_COIN, 2, 0])
    const unhardened_wallet_pk = unhardened_wallet_sk.getG1()
    const unhardened_wallet_pk_hex = bytesToHex(unhardened_wallet_pk.toBytes())

    console.log("%c 🔑 [XCHA FRONTEND CRYPTO AUDIT] ", "background: #8B5CF6; color: white; font-weight: bold; padding: 4px; border-radius: 4px;")
    console.log(`1. Mnemonic: "${clearMnemonic.trim()}"`)
    console.log(`2. Master SK Hex: ${master_sk_hex}`)
    console.log(`3. Master PK Hex: ${master_pk_hex}`)
    console.log(`4. Fingerprint: ${fingerprint}`)
    console.log(`5. Farmer PK Hex: ${farmer_pk_hex}`)
    console.log(`6. Pool PK Hex: ${pool_pk_hex}`)
    console.log(`7. Wallet SK Hex (Hardened): ${wallet_sk_hex}`)
    console.log(`🚀 ИТОГОВЫЙ ПАБЛИК ДЛЯ ПИТОНА (Unhardened PK Hex): %c${unhardened_wallet_pk_hex}`, "color: #10B981; font-weight: bold; font-size: 11px;")
    console.log("%c ---------------------------------------------------- ", "color: #52525b;")

    return unhardened_wallet_pk_hex
  } catch (e) {
    console.error("Ошибка при расчете ключей на фронтенде (runCryptoAudit):", e)
    return null
  }
}

/**
 * Подписывает массив монет (spends) и возвращает агрегированную node_signature.
 */
/**
 * Подписывает готовые хэши сообщений для массива монет (Multi-spend).
 * Название функции жестко синхронизировано с твоим фронтенд-хуком.
 */
export function signTransactionSpends(syntheticSkHex: string, spendsList: any[]): string | null {
  try {
    if (!spendsList || spendsList.length === 0) {
      throw new Error("Массив монет пуст или не передан для подписи");
    }

    const cleanSkHex = syntheticSkHex.replace("0x", "");
    const skBytes = hexToBytes(cleanSkHex);
    
    // Безопасно загружаем приватный ключ через байты
    const privateKey = PrivateKey.fromBytes ? PrivateKey.fromBytes(skBytes) : PrivateKey.fromHex(cleanSkHex);
    const publicKey = privateKey.getG1();
    const currentPkHex = bytesToHex(publicKey.toBytes());

    console.log("%c 🔐 [XCHA CRYPTO - SIGN TRANSACTION SPENDS] ", "background: #10B981; color: white; font-weight: bold; padding: 4px; border-radius: 4px.");
    console.log("1. Используемый PK на фронте:", currentPkHex);
    console.log(`2. Количество монет на подписание: ${spendsList.length}`);

    const signatures: any[] = []

    for (const spend of spendsList) {
      // Питон уже прислал нам ПОЛНОСТЬЮ готовую склейку AGG_SIG_ME!
      const finalBufferToSign = hexToBytes(spend.message_hash_hex);
      
      console.log(` -> Подписание монеты ID: ${spend.coin_id.substring(0, 10)}...`);
      console.log("    Готовый хэш из питона:", spend.message_hash_hex);

      // Просто подписываем готовые 32 байта
      const coinSignature = AugSchemeMPL.sign(privateKey, finalBufferToSign);
      signatures.push(coinSignature);
    }

    // Криптографически агрегируем подписи всех монет бандла в одну точку на кривой
    const aggregatedSignature = AugSchemeMPL.aggregate(signatures);
    const finalSignatureHex = bytesToHex(aggregatedSignature.toBytes());

    console.log("🚀 Итоговая агрегированная подпись транзакции:", finalSignatureHex);
    console.log("%c ----------------------------------------------------------- ", "color: #52525b.");

    return finalSignatureHex;

  } catch (e: any) {
    console.error("Критическая ошибка внутри signTransactionSpends:", e);
    return null;
  }
}
