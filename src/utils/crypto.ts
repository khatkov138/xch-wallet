
import bip39 from 'bip39';
import chiaBls from 'chia-bls';
import { sha256 } from '@noble/hashes/sha2'

const { PrivateKey } = chiaBls

// Железобетонная база: размер поля кривой BLS12-381
const GROUP_ORDER = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n


// Параметры для защиты от брутфорса (BIP-38 / PBKDF2 стандарты)
const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;




function intToBytes4(val: number): Uint8Array {
    return new Uint8Array([(val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff]);
}
/**
 * Переводит массив байт (Uint8Array) в Hex-строку
 */
function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}
function bytesToBigInt(bytes: Uint8Array | Buffer): bigint {
    // Нативный и быстрый перевод байт-буфера в BigInt через Hex
    return BigInt("0x" + Buffer.from(bytes).toString("hex"))
}

/**
 * Переводит Hex-строку в массив байт (Uint8Array)
 */
function hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.replace(/\s+/g, ""); // Убираем пробелы, если они есть
    if (cleanHex.length % 2 !== 0) {
        throw new Error("Неверная длина Hex-строки");
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Шифрует мнемонику с помощью PBKDF2 + AES-GCM 256
 */
export async function encryptMnemonic(m: string, pin: string): Promise<string> {
    if (!m || !pin) throw new Error("Мнемоника и ПИН-код обязательны для шифрования");

    const enc = new TextEncoder();
    const pinBytes = enc.encode(pin);

    // Генерация случайной соли и IV (Initialization Vector)
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Импорт исходного ПИН-кода для деривации
    const baseKey = await crypto.subtle.importKey(
        "raw",
        pinBytes,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    // Растягивание ключа (Key Stretching) с помощью PBKDF2
    const aesKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    // Шифрование данных
    const encryptedContent = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        enc.encode(m.trim())
    );

    const encryptedBytes = new Uint8Array(encryptedContent);

    // Собираем всё в один массив: [соль (16б)] + [iv (12б)] + [зашифрованный текст]
    const res = new Uint8Array(salt.length + iv.length + encryptedBytes.length);
    res.set(salt, 0);
    res.set(iv, salt.length);
    res.set(encryptedBytes, salt.length + iv.length);

    return bytesToHex(res);
}

/**
 * Дешифрует мнемонику с помощью переданного ПИН-кода
 */
export async function decryptMnemonic(ed: string, pin: string): Promise<string> {
    if (!ed || !pin) throw new Error("Данные для дешифрования и ПИН-код обязательны");

    // 1. Парсим hex в байты
    if (!/^[0-9a-fA-F\s]+$/.test(ed)) {
        throw new Error("Данные должны быть в формате Hex");
    }

    const b = hexToBytes(ed);
    const minLength = SALT_LENGTH + IV_LENGTH;

    if (b.length < minLength) {
        throw new Error("Некорректный формат зашифрованных данных (слишком короткая строка)");
    }

    // 2. Нарезаем строго по фиксированным координатам
    const salt = b.slice(0, SALT_LENGTH);
    const iv = b.slice(SALT_LENGTH, minLength);

    // Вырезаем шифротекст безопасным методом
    const data = b.slice(minLength);

    // 3. Импорт и деривация ключа
    const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(pin),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const aesKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    // 4. Дешифрование
    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            aesKey,
            data
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
        console.error("Криптографический сбой при дешифровании:", err);
        // Специально подменяем ошибку, чтобы злоумышленник не понял, в чем именно сбой (в ПИН-коде или структуре)
        throw new Error("Неверный ПИН-код или поврежденные данные кошелька");
    }
}

export async function deriveMasterPublicKey(mnemonic: string): Promise<string> {
    const cleanMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");

    if (!bip39.validateMnemonic(cleanMnemonic)) {
        throw new Error('Невалидная мнемоника (проверьте правильность слов)');
    }

    // 1. Генерируем Seed из слов кошелька
    const seed = await bip39.mnemonicToSeed(cleanMnemonic); // Используем async версию для отзывчивости интерфейса

    // 2. Получаем Master Private Key
    const masterSk = PrivateKey.fromSeed(seed);

    // 3. Извлекаем чистую G1 точку (строку Master Public Key)
    return masterSk.getG1().toHex();
}




export function chiaDeriveChildSkUnhardened(parentSk: any, index: number): any {
    const parentPkBytes = parentSk.getG1().toBytes();
    const indexBytes = intToBytes4(index);
    const concat = new Uint8Array(parentPkBytes.length + indexBytes.length);
    concat.set(parentPkBytes, 0); concat.set(indexBytes, parentPkBytes.length);
    const hash = sha256(concat);
    const hashBigInt = hash.reduce((acc: bigint, v: number) => (acc << 8n) + BigInt(v), 0n);
    const parentSkBigInt = parentSk.toBytes().reduce((acc: bigint, v: number) => (acc << 8n) + BigInt(v), 0n);
    const childSkBigInt = (parentSkBigInt + hashBigInt) % GROUP_ORDER;
    return PrivateKey.fromHex(childSkBigInt.toString(16).padStart(64, '0'));
}

export function calculateSyntheticSecretKey(
  targetSk: InstanceType<typeof PrivateKey>,
  hiddenPuzzleHashHex: string // 🔥 Принимаем точный хэш с сервера
): InstanceType<typeof PrivateKey> {
  const targetPkBytes = targetSk.getG1().toBytes()
  const hiddenPuzzleHashBytes = Buffer.from(hiddenPuzzleHashHex.replace("0x", ""), "hex")
  
  // Склеиваем байты публичного ключа и скрытого паззла (48 байт + 32 байта = 80 байт)
  const concat = new Uint8Array(targetPkBytes.length + hiddenPuzzleHashBytes.length)
  concat.set(targetPkBytes, 0)
  concat.set(hiddenPuzzleHashBytes, targetPkBytes.length)
  
  // Хэшируем склеенный буфер через SHA-256
  const offsetHashBytes = sha256(concat)
  
  // Переводим байты в BigInt криптографической длинной арифметики
  const offsetBigInt = BigInt("0x" + Buffer.from(offsetHashBytes).toString("hex"))
  const targetSkBigInt = BigInt("0x" + Buffer.from(targetSk.toBytes()).toString("hex"))
  
  // Сдвиг скаляров по модулю поля группы BLS12-381
  const syntheticSkBigInt = (targetSkBigInt + offsetBigInt) % GROUP_ORDER
  
  return PrivateKey.fromHex(syntheticSkBigInt.toString(16).padStart(64, '0'))
}