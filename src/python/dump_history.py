import os
import json
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
BASE_RPC_URL = "https://localhost:8555"

def get_ssl_credentials():
    home_dir = os.environ.get("USERPROFILE") or os.path.expanduser("~") or "C:\\Users\\khatk"
    folders = ["testnet11", "mainnet"]
    for folder in folders:
        cert_path = os.path.join(home_dir, ".chia", folder, "config", "ssl", "full_node", "private_full_node.crt")
        key_path = os.path.join(home_dir, ".chia", folder, "config", "ssl", "full_node", "private_full_node.key")
        if os.path.exists(cert_path) and os.path.exists(key_path):
            return cert_path, key_path
    return "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.crt", "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.key"

if __name__ == "__main__":
    print("=" * 80)
    print("🕵️‍♂️ СКРИПТ-ШПИОН: ДАМП ОФИЦИАЛЬНОГО PUZZLE & SOLUTION ИЗ БЛОКЧЕЙНА CHIA")
    print("=" * 80)
    
    # Хэш родительской монеты, которая создала твою текущую сдачу
    PARENT_COIN_ID = "f84eb2a9d5bb91b05d7c4365c7edb2d5a1d3d8c63ed7de72d9f218afab84a01f"
    
    try:
        cert_path, key_path = get_ssl_credentials()
        
        # Делаем запрос к фулл-ноде, чтобы получить детали траты этой родительской монеты
        url = f"{BASE_RPC_URL}/get_puzzle_and_solution"
        payload = {
            "coin_id": PARENT_COIN_ID,
            "height": 4885451 # Высота блока из твоего дебаг-лога
        }
        
        print(f"[RPC] Запрашиваем исторические данные траты для Coin ID: 0x{PARENT_COIN_ID}...")
        response = requests.post(url, json=payload, cert=(cert_path, key_path), verify=False).json()
        
        if not response.get("success"):
            raise ValueError(f"Нода не смогла вернуть данные: {response.get('error')}")
            
        coin_solution = response.get("coin_solution", {})
        
        print("\n" + "🔥" * 15 + " СТРУКТУРА НАЙДЕННОЙ ОФИЦИАЛЬНОЙ ТРАНЗАКЦИИ " + "🔥" * 15)
        
        # Выводим структуру монеты, пазл и решение
        print(json.dumps(coin_solution, indent=4))
        
        print("=" * 90)
        print("🚀 Скопируй этот вывод! Из него мы вытащим точный формат solution и закроем BAD_AGGREGATE_SIGNATURE!")
        print("=" * 90)
        
    except Exception as e:
        print(f"\n❌ [ОШИБКА ШПИОНА]: {e}")
