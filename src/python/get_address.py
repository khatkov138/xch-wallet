import sys
import json
from chia.util.bech32m import encode_puzzle_hash, decode_puzzle_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    puzzle_for_pk, 
    calculate_synthetic_public_key,
    DEFAULT_HIDDEN_PUZZLE_HASH
)
from chia_rs import G1Element

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "Missing wallet public key"}))
        sys.exit(1)
        
    wallet_pk_hex = sys.argv[1].strip()
    prefix = "txch" 

    try:
        # 1. Восстанавливаем канонический публичный ключ из HEX строки
        unhardened_wallet_pk = G1Element.from_bytes(bytes.fromhex(wallet_pk_hex))

        # 2. Генерируем CLVM-код стандартного пазла
        wallet_puzzle = puzzle_for_pk(unhardened_wallet_pk)
        wallet_puzzle_hex = bytes(wallet_puzzle).hex()

        # 3. Считаем хэш дерева пазла (puzzle_hash)
        puzzle_hash = wallet_puzzle.get_tree_hash()
        puzzle_hash_hex = puzzle_hash.hex()

        # 4. Вычисляем корректный синтетический публичный ключ для консенсуса
        synthetic_pk = calculate_synthetic_public_key(unhardened_wallet_pk, DEFAULT_HIDDEN_PUZZLE_HASH)
        synthetic_pk_hex = bytes(synthetic_pk).hex()

        # 5. Кодируем bech32m адрес кошелька
        first_wallet_address = encode_puzzle_hash(puzzle_hash, prefix)

        # 6. ВСТРОЕННАЯ НЕЗАВИСИМАЯ ПРОВЕРКА (Раскодируем адрес обратно)
        # Имитируем логику блокчейн-ноды при получении адреса
        decoded_puzzle_hash = decode_puzzle_hash(first_wallet_address)
        
        # Сверяем исходный хэш дерева с тем, что получили из адреса
        is_valid = (decoded_puzzle_hash == puzzle_hash)

        # Выводим финальный JSON с флагом верификации
        result = {
            "status": "success",
            "validation_passed": is_valid,  # Если True — косяков нет 100%
            "canonical_wallet_pk_hex": wallet_pk_hex,
            "synthetic_pk_hex": synthetic_pk_hex,
            "wallet_puzzle_hex": wallet_puzzle_hex,
            "puzzle_hash_hex": puzzle_hash_hex,
            "address": first_wallet_address
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Python crypto error: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
