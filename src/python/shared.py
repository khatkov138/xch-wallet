import os
import requests
import urllib3
import hashlib
from pathlib import Path
from chia_rs import AugSchemeMPL, G1Element

# Отключаем предупреждения о незащищенном SSL-соединении (так как сертификаты Chia самоподписанные)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Адрес локальной ноды Chia RPC по умолчанию
BASE_RPC_URL = "https://localhost:8555"

def get_ssl_credentials():
    """
    Автоматически определяет активную сеть через config.yaml Chia 
    и возвращает пути к правильным SSL-сертификатам.
    """
    home = Path.home()
    
    # 1. По умолчанию выставляем базовую папку mainnet
    root_path = home / ".chia/mainnet"
    
    # 2. Проверяем, какая сеть сейчас реально активна в конфиге Chia
    config_file = root_path / "config/config.yaml"
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                content = f.read()
                # Если в конфиге прописан testnet11, переключаем фокус на папку тестнета
                if 'selected_network: "testnet11"' in content:
                    testnet_path = home / ".chia/testnet11"
                    if testnet_path.exists():
                        root_path = testnet_path
        except Exception as e:
            print(f"⚠️ [SSL AUTO] Не удалось прочитать config.yaml, используем дефолт: {e}")
            
    # 3. Формируем пути к сертификатам full_node
    c = root_path / "config/ssl/full_node/private_full_node.crt"
    k = root_path / "config/ssl/full_node/private_full_node.key"
    
    # Если файлы найдены — возвращаем их
    if c.exists() and k.exists(): 
        return str(c), str(k)
        
    # Резервный хардкод путь для Windows (если стандартный поиск через Path.home() дал сбой)
    # Скрипт проверит, какая сеть была выбрана, и подставит её в хардкод-путь
    current_net = "testnet11" if "testnet11" in str(root_path) else "mainnet"
    return (
        f"C:\\Users\\khatk\\.chia\\{current_net}\\config\\ssl\\full_node\\private_full_node.crt", 
        f"C:\\Users\\khatk\\.chia\\{current_net}\\config\\ssl\\full_node\\private_full_node.key"
    )

def get_wallet_pk_unhardened(master_pk: G1Element, index: int) -> G1Element:
    """
    Выводит несвязанный (unhardened) публичный ключ для конкретного индекса кошелька.
    """
    path = [12381, 8444, 2, index]
    current_pk = master_pk
    for element in path: 
        current_pk = AugSchemeMPL.derive_child_pk_unhardened(current_pk, element)
    return current_pk

def fetch_balances_from_node(puzzle_hashes_dict):
    """
    Запрашивает информацию о монетах с ноды Chia по словарю puzzle hashes.
    """
    c_p, k_p = get_ssl_credentials()
    res = requests.post(
        f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes", 
        json={
            "puzzle_hashes": list(puzzle_hashes_dict.keys()), 
            "include_spent_coins": False, 
            "start_height": 0
        }, 
        cert=(c_p, k_p), 
        verify=False
    ).json()
    
    if not res.get("success"): 
        raise ValueError(res.get("error"))
    return res.get("coin_records", [])

def fetch_genesis(cert, key):
    """
    Получает хэш генезис-блока (высота 0) для верификации сети.
    """
    res = requests.post(
        f"{BASE_RPC_URL}/get_block_record_by_height", 
        json={"height": 0}, 
        cert=(cert, key), 
        verify=False
    ).json()
    
    if not res.get("success"): 
        raise ValueError(res.get("error"))
    return bytes.fromhex(res["block_record"]["prev_hash"].replace("0x", ""))
