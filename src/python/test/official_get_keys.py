import os
import json
import requests
import urllib3
from chia_rs import AugSchemeMPL, G1Element
from chia.util.bech32m import encode_puzzle_hash

# Импорты деривации ядра Chia
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk

# Отключаем ворнинги SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_RPC_URL = "https://localhost:8555"  # Порт Full Node RPC
TESTNET_PREFIX = "txch"                  # Для майннета поменяй на "xch"

# ДАННЫЕ ИЗ ВАШЕГО CLI (БЕЗ МНЕМОНИКИ И ПРИВАТНЫХ КЛЮЧЕЙ)
MASTER_PUBLIC_KEY_HEX = "8051ff395c5ca08d48719d2d2efcf673f05523ae2839419ab719473c940136ae456750ac9965d0b1628f545d8d2fe6f2"

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

def get_wallet_pk_unhardened(master_pk: G1Element, index: int) -> G1Element:
    """
    Прямая деривация публичного ключа кошелька по индексу с использованием AugSchemeMPL.
    Полный путь деривации: m/12381/8444/2/index
    """
    path = [12381, 8444, 2, index]
    current_pk = master_pk
    for element in path:
        current_pk = AugSchemeMPL.derive_child_pk_unhardened(current_pk, element)
    return current_pk

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
    print("🤖 АВТОНОМНЫЙ ПУБЛИЧНЫЙ RPC СКАНЕР БАЛАНСОВ НА 200 АДРЕСОВ")
    print("=" * 80)
    
    try:
        # 1. Загружаем Master Public Key из шестнадцатеричной строки
        master_pk = G1Element.from_bytes(bytes.fromhex(MASTER_PUBLIC_KEY_HEX))
        
        puzzle_hashes_map = {}
        
        print("Генерация локальной матрицы адресов по ПУБЛИЧНЫМ ключам...")
        for index in range(200):
            # Деривация публичного ключа для конкретного индекса напрямую через bls криптографию
            wallet_pk = get_wallet_pk_unhardened(master_pk, index)
            
            # Из публичного ключа генерируем стандартный смарт-контракт (puzzle) монеты Chia
            puzzle = puzzle_for_pk(wallet_pk)
            puz_hash_bytes = puzzle.get_tree_hash()
            puz_hash_hex = puz_hash_bytes.hex()
            
            # Кодируем в bech32m адрес кошелька
            addr = encode_puzzle_hash(puz_hash_bytes, TESTNET_PREFIX)
            puzzle_hashes_map[puz_hash_hex] = (index, addr)
            
            # Выводим первый сгенерированный адрес для визуальной проверки на соответствие вашему CLI
            if index == 0:
                print(f"[Проверка] Сгенерирован первый адрес: {addr}")
            
        print(f"Локальная матрица готова: {len(puzzle_hashes_map)} элементов.")
        print("-" * 80)
        
        # 2. Делаем запрос к Full Node RPC для проверки текущих балансов
        check_balances_via_full_node(puzzle_hashes_map)
        
    except Exception as e:
        print(f"\n❌ [ОШИБКА ИСПОЛНЕНИЯ]: {e}")
