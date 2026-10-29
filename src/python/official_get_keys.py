import os
import json
import requests
import urllib3
from chia_rs import AugSchemeMPL, PrivateKey, G1Element
from chia.util.bech32m import encode_puzzle_hash

# Импорты деривации ядра Chia
from chia.util.keychain import mnemonic_to_seed
from chia.wallet.derive_keys import master_sk_to_wallet_sk_unhardened
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk

# Отключаем ворнинги SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_RPC_URL = "https://localhost:8555"  # Порт Full Node RPC
TESTNET_PREFIX = "txch"                  # Для майннета поменяй на "xch"

def get_ssl_credentials():
    """Динамический поиск SSL сертификатов full_node"""
    home_dir = os.environ.get("USERPROFILE") or os.path.expanduser("~") or "C:\\Users\\khatk"
    folders = ["testnet11", "mainnet"]
    for folder in folders:
        cert_path = os.path.join(home_dir, ".chia", folder, "config", "ssl", "full_node", "private_full_node.crt")
        key_path = os.path.join(home_dir, ".chia", folder, "config", "ssl", "full_node", "private_full_node.key")
        if os.path.exists(cert_path) and os.path.exists(key_path):
            return cert_path, key_path
    return "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.crt", "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.key"

def get_puzzle_hash_from_sk(wallet_sk: PrivateKey) -> bytes:
    """Напрямую извлекает bytes пазл-хэша из приватного ключа"""
    raw_pk = wallet_sk.get_g1()
    wallet_pk = G1Element.from_bytes(bytes(raw_pk))
    puzzle = puzzle_for_pk(wallet_pk)
    return puzzle.get_tree_hash()

def check_balances_via_full_node(puzzle_hashes_dict):
    """
    Отправляет массив пазл-хэшей в Full Node RPC и парсит unspent монеты.
    puzzle_hashes_dict: словарь {hex_puzzle_hash: (index, address)}
    """
    cert_path, key_path = get_ssl_credentials()
    url = f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes"
    
    # Собираем только список хэшей для тела RPC-запроса
    hashes_to_query = list(puzzle_hashes_dict.keys())
    
    payload = {
        "puzzle_hashes": hashes_to_query,
        "include_spent_coins": False, # Нам нужны только незатраченные (текущий баланс)
        "start_height": 0
    }
    
    print(f"[RPC] Отправка запроса на получение монет для {len(hashes_to_query)} хэшей...")
    response = requests.post(url, json=payload, cert=(cert_path, key_path), verify=False)
    data = response.json()
    
    if not data.get("success"):
        raise ValueError(f"Ошибка RPC ноды: {data.get('error')}")
        
    coin_records = data.get("coin_records", [])
    print(f"[RPC] Получено записей о монетах из блокчейна: {len(coin_records)}")
    
    total_mojos = 0
    balances_by_index = {}
    
    # Проходим по всем найденным монетам
    for record in coin_records:
        coin = record.get("coin", {})
        puz_hash = coin.get("puzzle_hash")
        amount = coin.get("amount", 0)   # Значение в Mojos (1 XCH = 1,000,000,000,000 Mojo)
        
        # Очищаем префикс 0x, если нода его вернула
        clean_puz_hash = puz_hash[2:] if puz_hash.startswith("0x") else puz_hash
        
        if clean_puz_hash in puzzle_hashes_dict:
            index, address = puzzle_hashes_dict[clean_puz_hash]
            total_mojos += amount
            
            if index not in balances_by_index:
                balances_by_index[index] = {"address": address, "mojos": 0}
            balances_by_index[index]["mojos"] += amount

    print("\n" + "="*30 + " РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ БАЛАНСОВ " + "="*30)
    if not balances_by_index:
        print("📭 Баланс пуст. Ни на одном из 200 адресов монет не обнаружено.")
    else:
        for idx, info in sorted(balances_by_index.items()):
            xch_amount = info["mojos"] / 1000000000000
            print(f"💰 [Индекс {idx:03d}] -> {info['address']}")
            print(f"               Баланс: {xch_amount} XCH ({info['mojos']} mojos)")
            print("-" * 75)
            
    total_xch = total_mojos / 1000000000000
    print(f"🔥 ИТОГОВЫЙ ОБЩИЙ БАЛАНС КОШЕЛЬКА: {total_xch} XCH")
    print("=" * 94 + "\n")

if __name__ == "__main__":
    print("=" * 80)
    print("🤖 АВТОНОМНЫЙ RPC СКАНЕР БАЛАНСОВ НА 200 АДРЕСОВ")
    print("=" * 80)
    
    MNEMONIC = (
        "material harvest garage wish seed possible item solar zero pupil off saddle "
        "glass dial burden desk apology wrap ivory work need favorite tilt burden"
    )
    
    try:
        # 1. Генерируем ключи и создаем карту соответствия хэшей к индексам
        seed = mnemonic_to_seed(MNEMONIC)
        master_sk = AugSchemeMPL.key_gen(seed)
        
        # Нам нужен быстрый поиск O(1), поэтому делаем словарь: {hex_hash: (index, address)}
        puzzle_hashes_map = {}
        
        print("Генерация локальной матрицы адресов и хэшей...")
        for index in range(200):
            wallet_sk = master_sk_to_wallet_sk_unhardened(master_sk, index)
            puz_hash_bytes = get_puzzle_hash_from_sk(wallet_sk)
            puz_hash_hex = puz_hash_bytes.hex()
            
            addr = encode_puzzle_hash(puz_hash_bytes, TESTNET_PREFIX)
            puzzle_hashes_map[puz_hash_hex] = (index, addr)
            
        print(f"Локальная матрица готова: {len(puzzle_hashes_map)} элементов.")
        print("-" * 80)
        
        # 2. Стучимся в Full Node RPC и забираем балансы
        check_balances_via_full_node(puzzle_hashes_map)
        
    except Exception as e:
        print(f"\n❌ [ОШИБКА ИСПОЛНЕНИЯ]: {e}")
