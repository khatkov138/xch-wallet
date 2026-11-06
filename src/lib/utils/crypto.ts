
import bip39 from 'bip39';
import chiaBls, { AugSchemeMPL } from 'chia-bls';
import { sha256 } from '@noble/hashes/sha2'
import { bech32m } from "bech32"

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

export function puzzleHashToAddress(puzzleHash: string | undefined | null, network: string | undefined | null): string {
    // 🎯 Если хэш или сеть не переданы, сразу возвращаем пустую строку без ошибок
    if (!puzzleHash || !network) return ""
    
    try {
        // 🎯 Сама определяет префикс на основе переданной строки сети
        const prefix = network.toLowerCase().includes("testnet") ? "txch" : "xch"
        
        const cleanHash = puzzleHash.startsWith("0x") ? puzzleHash.slice(2) : puzzleHash
        const bytes = hexToBytes(cleanHash)
        const words = bech32m.toWords(bytes)
        return bech32m.encode(prefix, words)
    } catch (err) {
        console.error("❌ Ошибка кодирования адреса:", err)
        return ""
    }
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



// Гарантированный Big-Endian перевод числа в 4 байта
function intToBytes4BE(value: number): Uint8Array {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, value, false); // false = Big Endian (канонично для Chia Unhardened)
    return new Uint8Array(buffer);
}

export function chiaDeriveChildSkUnhardened(parentSk: any, index: number): any {
    // 1. Получаем байты публичного ключа родителя (всегда 48 байт)
    const parentPkBytes = parentSk.getG1().toBytes();

    // 2. Кодируем индекс строго в 4 байта Big-Endian
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, index, false); // false = Big Endian
    const indexBytes = new Uint8Array(buffer);

    // 3. Склеиваем PK и Index (52 байта)
    const concat = new Uint8Array(parentPkBytes.length + indexBytes.length);
    concat.set(parentPkBytes, 0);
    concat.set(indexBytes, parentPkBytes.length);

    // 4. Хэшируем буфер через SHA-256 (получаем 32 байта)
    const hashBytes = sha256(concat);

    // 5. Переводим хэш и родительский ключ в BigInt строго через Хекс (Big-Endian представление)
    const hashHex = Buffer.from(hashBytes).toString("hex");
    const parentSkHex = Buffer.from(parentSk.toBytes()).toString("hex");

    const hashBigInt = BigInt("0x" + hashHex);
    const parentSkBigInt = BigInt("0x" + parentSkHex);

    // 6. Сложение скаляров по модулю порядка группы BLS12-381
    const GROUP_ORDER = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;
    const childSkBigInt = (parentSkBigInt + hashBigInt) % GROUP_ORDER;

    // 7. БЕЗОПАСНАЯ КОНВЕРТАЦИЯ: Переводим BigInt обратно в 32-байтовый буфер, 
    // полностью исключая баги работы строк toString(16) в JS
    const childBytes = new Uint8Array(32);
    let tempBigInt = childSkBigInt;
    for (let i = 31; i >= 0; i--) {
        childBytes[i] = Number(tempBigInt & 0xffn);
        tempBigInt >>= 8n;
    }

    // 8. Инициализируем приватный ключ из чистого канонического буфера байт
    const finalHex = Buffer.from(childBytes).toString("hex");
    return PrivateKey.fromHex(finalHex);
}



/**
 * Безопасно деривирует некостодиальную ветку ключей Chia и генерирует валидную подпись транзакции
 */
export function signChiaTransaction({ mnemonic, walletIndex, messageHex, syntheticOffsetHex }: {
    mnemonic: string;
    walletIndex: number;
    messageHex: string;
    syntheticOffsetHex: string; // 🔥 Принимаем готовый оффсет-скаляр с бэкенда
}): string {
    const seed = bip39.mnemonicToSeedSync(mnemonic.trim())
    const masterSk = PrivateKey.fromSeed(seed)

    // Каноническая unhardened деривация ветки Core Wallet Chia
    const lvl1 = chiaDeriveChildSkUnhardened(masterSk, 12381)
    const lvl2 = chiaDeriveChildSkUnhardened(lvl1, 8444)
    const walletBranchSk = chiaDeriveChildSkUnhardened(lvl2, 2)
    const targetSk = chiaDeriveChildSkUnhardened(walletBranchSk, Number(walletIndex))

    // 🎯 ШАГ 1: Превращаем присланный Python-бэкендом оффсет строго в PrivateKey смещения.
    // Флаг 'false' указывает библиотеке брать байты как есть, без повторного хэширования сида.
    const offsetSkBytes = Buffer.from(syntheticOffsetHex.replace("0x", ""), "hex")
    const offsetSk = PrivateKey.fromBytes(offsetSkBytes)

    // 🎯 ШАГ 2: КРИПТОГРАФИЧЕСКОЕ СЛОЖЕНИЕ КЛЮЧЕЙ НА УРОВНЕ C++ (WASM)
    // Никаких строк, BigInt и GROUP_ORDER. Складываем скаляры внутри памяти библиотеки.
    let syntheticSk: InstanceType<typeof PrivateKey>;

    if (typeof (targetSk as any).add === 'function') {
        // Если твоя версия библиотеки имеет встроенный метод сложения .add()
        syntheticSk = (targetSk as any).add(offsetSk);
    } else {
        // Если прямого метода нет, aggregate выполняет абсолютно идентичное сложение скаляров на кривой
        // @ts-ignore
        syntheticSk = PrivateKey.aggregate([targetSk, offsetSk]);
    }

    // Очищаем и переводим входящее сообщение строго в сырые байты
    const cleanMsgHex = messageHex.replace("0x", "").trim().toLowerCase();
    const messageBytes = Buffer.from(cleanMsgHex, 'hex')

    console.log(`[КРИТИЧЕСКИЙ ДЕБАГ] Длина байт сообщения для подписи на фронте: ${messageBytes.length} байт`);

    // Подписываем сырой массив байт
    const signature = AugSchemeMPL.sign(syntheticSk, messageBytes)

    return Buffer.from(signature.toBytes()).toString('hex')
}


export function calculateChiaCoinId(parentHex: string, puzzleHashHex: string, amountMojo: number | bigint): string {
    const cleanParent = parentHex.replace("0x", "").toLowerCase().trim();
    const cleanPuzzle = puzzleHashHex.replace("0x", "").toLowerCase().trim();

    const parentBytes = Uint8Array.from(cleanParent.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const puzzleBytes = Uint8Array.from(cleanPuzzle.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));

    // В Chia числа сериализуются как знаковые Big-Endian с минимальной длиной
    let val = BigInt(amountMojo);
    const amountArray: number[] = [];

    if (val === 0n) {
        amountArray.push(0);
    } else {
        while (val > 0n) {
            amountArray.unshift(Number(val & 0xffn));
            val >>= 8n;
        }
        // Если старший бит равен 1, добавляем 00, чтобы число не считалось отрицательным в CLVM
        if (amountArray[0] >= 0x80) {
            amountArray.unshift(0);
        }
    }
    const amountBytes = Uint8Array.from(amountArray);

    // Склеиваем точный буфер
    const concat = new Uint8Array(parentBytes.length + puzzleBytes.length + amountBytes.length);
    concat.set(parentBytes, 0);
    concat.set(puzzleBytes, parentBytes.length);
    concat.set(amountBytes, parentBytes.length + puzzleBytes.length);

    return Array.from(sha256(concat)).map(b => b.toString(16).padStart(2, '0')).join('');
}