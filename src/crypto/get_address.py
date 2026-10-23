import sys
import json
from chia.util.bech32m import encode_puzzle_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    puzzle_hash_for_pk, 
    puzzle_for_pk, 
    calculate_synthetic_public_key
)
from chia_rs import G1Element

def main():
    # Проверяем, что передали публичный ключ кошелька
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "Missing wallet public key"}))
        sys.exit(1)
        
    wallet_pk_hex = sys.argv[1]
    
    # Автоматически определяем префикс сети (txch для тестнета, xch для мейннета)
    # По умолчанию ставим txch, если тебе нужен мейннет — поменяй на "xch"
    prefix = "txch" 

    try:
        # 1. Восстанавливаем объект публичного ключа из HEX строки
        unhardened_wallet_pk = G1Element.from_bytes(bytes.fromhex(wallet_pk_hex))

        # 2. Генерируем CLVM структуру (внутренности пазла Chia)
        wallet_puzzle = puzzle_for_pk(unhardened_wallet_pk)
        wallet_puzzle_hex = bytes(wallet_puzzle).hex()

        # 3. Считаем хэш дерева пазла
        wallet_tree_hash = wallet_puzzle.get_tree_hash()
        wallet_tree_hash_hex = wallet_tree_hash.hex()

        # 4. Вычисляем синтетический публичный ключ
        synthetic_pk = calculate_synthetic_public_key(unhardened_wallet_pk, wallet_tree_hash)
        synthetic_pk_hex = bytes(synthetic_pk).hex()

        # 5. Получаем итоговый puzzle hash
        puzzle_hash = puzzle_hash_for_pk(unhardened_wallet_pk)
        puzzle_hash_hex = puzzle_hash.hex()

        # 6. Кодируем bech32m адрес кошелька
        first_wallet_address = encode_puzzle_hash(puzzle_hash, prefix)

        # Выводим всё в красивом JSON для Node.js
        result = {
            "status": "success",
            "wallet_puzzle_hex": wallet_puzzle_hex,
            "wallet_tree_hash_hex": wallet_tree_hash_hex,
            "synthetic_pk_hex": synthetic_pk_hex,
            "puzzle_hash_hex": puzzle_hash_hex,
            "address": first_wallet_address
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
