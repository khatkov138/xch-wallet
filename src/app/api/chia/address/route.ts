import { NextRequest, NextResponse } from "next/server";
import { Program } from "clvm-lib";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { sha256 } from "@noble/hashes/sha2";
import { bech32m } from "bech32"; // Официальный, рабочий пакет bech32

// Константный хэш скрытого пузла Chia из ШАГА 2 питоновского лога
const DEFAULT_HIDDEN_PUZZLE_HASH = "711d6c4e32c92e53179b199484cf8c897542bc57f2b22582799f9d657eec4699";

// Базовая часть модуля p2_delegated_puzzle_or_hidden_puzzle ДО подстановки ключа (из питоновского ШАГА 3)
const PUZZLE_PREFIX_HEX = "ff02ffff01ff02ffff01ff02ffff03ff0bffff01ff02ffff03ffff09ff05ffff1dff0bffff1effff0bff0bffff02ff06ffff04ff02ffff04ff17ff8080808080808080ffff01ff02ff17ff2f80ffff01ff088080ff0180ffff01ff04ffff04ff04ffff04ff05ffff04ffff02ff06ffff04ff02ffff04ff17ff80808080ff80808080ffff02ff17ff2f808080ff0180ffff04ffff01ff32ff02ffff03ffff07ff0580ffff01ff0bffff0102ffff02ff06ffff04ff02ffff04ff09ff80808080ffff02ff06ffff04ff02ffff04ff0dff8080808080ffff01ff0bffff0101ff058080ff0180ff018080ffff04ffff01b0";

// Закрывающий хвост каррирования Chialisp из питоновского ШАГА 3
const PUZZLE_SUFFIX_HEX = "ff018080";

// --- Точный расчет Synthetic Public Key ---
function calculateSyntheticPublicKey(publicKeyHex: string): string {
  const pkBytes = Buffer.from(publicKeyHex, "hex");
  const pkPoint = bls12_381.G1.Point.fromBytes(pkBytes);

  const concatBuffer = Buffer.concat([pkBytes, Buffer.from(DEFAULT_HIDDEN_PUZZLE_HASH, "hex")]);
  const hash = sha256(concatBuffer);

  const offsetSk = BigInt("0x" + Buffer.from(hash).toString("hex")) % bls12_381.fields.Fr.ORDER;
  const offsetPkPoint = bls12_381.G1.Point.BASE.multiply(offsetSk);
  const syntheticPkPoint = pkPoint.add(offsetPkPoint);

  return Buffer.from(syntheticPkPoint.toBytes(true)).toString("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { wallet_pk_hex } = await req.json();
    const prefix = "txch"; 

    if (!wallet_pk_hex) {
      return NextResponse.json({ status: "error", message: "Missing wallet public key" }, { status: 400 });
    }

    const cleanPkHex = wallet_pk_hex.trim();

    // === ШАГ 1: Исходные данные ===
    console.log("\n=== [JS LOG] ШАГ 1: Исходные данные ===");
    console.log(`Входной PK HEX: ${cleanPkHex}`);

    // === ШАГ 2: Вычисление Synthetic Public Key ===
    const syntheticPkHex = calculateSyntheticPublicKey(cleanPkHex);
    console.log("\n=== [JS LOG] ШАГ 2: Вычисление Synthetic Public Key ===");
    console.log(`DEFAULT_HIDDEN_PUZZLE_HASH: ${DEFAULT_HIDDEN_PUZZLE_HASH}`);
    console.log(`Результат Synthetic PK HEX: ${syntheticPkHex}`);

    // === ШАГ 3: Создание пузла (wallet_puzzle) ===
    const walletPuzzleHex = `${PUZZLE_PREFIX_HEX}${syntheticPkHex}${PUZZLE_SUFFIX_HEX}`;
    const walletPuzzle = Program.deserializeHex(walletPuzzleHex);

    console.log("\n=== [JS LOG] ШАГ 3: Создание пузла (wallet_puzzle) ===");
    console.log(`Сериализованный wallet_puzzle (HEX): ${walletPuzzleHex}`);

    // === ШАГ 4: Расчет хэша дерева (Tree Hash) ===
    const puzzleHashHex = walletPuzzle.hashHex();
    const puzzleHashBytes = Buffer.from(puzzleHashHex, "hex");

    console.log("\n=== [JS LOG] ШАГ 4: Расчет хэша дерева (Tree Hash) ===");
    console.log(`Сырые байты хэша: [${Array.from(puzzleHashBytes).join(", ")}]`);
    console.log(`puzzle_hash_hex: ${puzzleHashHex}`);

    // === ШАГ 5: Кодирование Bech32m адреса ===
    // Конвертируем байты puzzle hash в 5-битные слова и кодируем через стабильный bech32m пакет
    const words = bech32m.toWords(puzzleHashBytes);
    const firstWalletAddress = bech32m.encode(prefix, words);

    console.log("\n=== [JS LOG] ШАГ 5: Кодирование Bech32m адреса ===");
    console.log(`Финальный адрес: ${firstWalletAddress}\n`);

    const validationPassed = (firstWalletAddress === "txch12dza3pwr4gzyfxgvl04tlu67nlhw5yv86sx3snkqr0tck2ss4uns4fqh9w");

    return NextResponse.json({
      status: "success",
      validation_passed: validationPassed,
      canonical_wallet_pk_hex: cleanPkHex,
      synthetic_pk_hex: syntheticPkHex, 
      wallet_puzzle_hex: walletPuzzleHex,
      puzzle_hash_hex: puzzleHashHex,
      address: firstWalletAddress
    });

  } catch (error: any) {
    console.error("[API CHIA ADDRESS ERROR]:", error);
    return NextResponse.json({ status: "error", message: `JS crypto error: ${error.message}` }, { status: 500 });
  }
}
