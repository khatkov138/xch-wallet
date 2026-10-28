import json, requests, urllib3
from get_genesis import get_ssl_credentials, BASE_RPC_URL
from get_keys import get_contract_data

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_raw_coin_records():
    """Запрашивает и возвращает сырой список монет от Full Node RPC"""
    cert_path, key_path = get_ssl_credentials()
    _, _, contract_puzzle_hash, contract_address = get_contract_data()
    
    url = f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hash"
    payload = {
        "puzzle_hash": f"0x{contract_puzzle_hash.hex()}",
        "include_spent_coins": False
    }
    
    response = requests.post(url, json=payload, cert=(cert_path, key_path), verify=False)
    return response.json()

def main():
    print("[БАЛАНС] Запуск проверки баланса смарт-контракта через Full Node RPC...")
    _, _, _, contract_address = get_contract_data()
    print(f"[ИНФО] Проверяемый адрес контракта: {contract_address}")
    
    try:
        data = get_raw_coin_records()
        print("\n" + "="*40 + " ОТВЕТ FULL NODE RPC НА БАЛАНС " + "="*40)
        print(json.dumps(data, indent=4, ensure_ascii=False))
        print("="*111 + "\n")
        
        coin_records = data.get("coin_records", [])
        total_mojo = 0
        unspent_count = 0
        
        for record in coin_records:
            if not record.get("spent", True):
                total_mojo += int(record["coin"]["amount"])
                unspent_count += 1
                
        print(f"[ИТОГ] Найдено активных UTXO монет: {unspent_count} шт.")
        print(f"[ИТОГ] Общий баланс контракта: {total_mojo / 1_000_000_000_000} XCH ({total_mojo} mojo)")
        
    except Exception as e:
        print(f"[ОШИБКА] Не удалось получить баланс от RPC: {e}")

if __name__ == "__main__":
    main()
