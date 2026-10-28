import os, sys, requests, urllib3, json

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

def fetch_genesis_challenge():
    cert_path, key_path = get_ssl_credentials()
    url = f"{BASE_RPC_URL}/get_block_record_by_height"
    
    # Дебаг-принт перед отправкой запроса
    print(f"\n[GET_GENESIS DEBUG] Отправка POST запроса на: {url}")
    print(f"[GET_GENESIS DEBUG] Используемые сертификаты из папки: {os.path.dirname(cert_path)}")
    
    response = requests.post(url, json={"height": 0}, cert=(cert_path, key_path), verify=False)
    data = response.json()
    
    # Выводим ВЕСЬ сырой JSON ответ от ноды Chia
    print("\n" + "="*30 + " СЫРОЙ ОТВЕТ RPC (ВЫСОТА 0) " + "="*30)
    print(json.dumps(data, indent=4, ensure_ascii=False))
    print("="*88 + "\n")
    
    if not data.get("success"): 
        raise ValueError(f"Ошибка RPC: {data.get('error')}")
        
    block_record = data.get("block_record", {})
    header_hash = block_record.get("header_hash")
    prev_hash = block_record.get("prev_hash")
    
    # Показываем разницу между хэшами блока
    print(f"[GET_GENESIS DEBUG] Поле 'header_hash': {header_hash}")
    print(f"[GET_GENESIS DEBUG] Поле 'prev_hash'  : {prev_hash} <-- (Берем для Genesis Challenge)")
    
    genesis_hex = prev_hash
    clean_hex = genesis_hex[2:] if genesis_hex.startswith("0x") else genesis_hex
    return bytes.fromhex(clean_hex)

if __name__ == "__main__":
    try:
        gen = fetch_genesis_challenge()
        print(f"\n🎯 [ФИНАЛЬНЫЙ РЕЗУЛЬТАТ] 0x{gen.hex()}")
    except Exception as e:
        print(f"\n❌ [ОШИБКА]: {e}")
