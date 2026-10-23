import sys
import json
import urllib.request
import ssl
import hashlib
import os

# Импортируем только базовый Coin, который работает везде без ошибок
from chia_rs import Coin

# Константа сети для Testnet11
TESTNET11_GENESIS_CHALLENGE = bytes.fromhex("37a90eb5185a9c4439a91ddc260b271fbc91ad6b3891461ea55bc9387455ab73")

def call_rpc(method, data):
    """Вызов RPC фулл-ноды с авторизацией через локальные SSL сертификаты Chia"""
    url = f"https://localhost:8555/{method}"
    
    home_dir = os.environ.get("USERPROFILE") or os.path.expanduser("~") or os.environ.get("HOME") or "C:\\Users\\khatk"
    network_folder = "testnet11" 
    
    ssl_dir = os.path.join(home_dir, ".chia", network_folder, "config", "ssl", "full_node")
    cert_file = os.path.join(ssl_dir, "private_full_node.crt")
    key_file = os.path.join(ssl_dir, "private_full_node.key")
    
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        ssl_dir = os.path.join(home_dir, ".chia", "mainnet", "config", "ssl", "full_node")
        cert_file = os.path.join(ssl_dir, "private_full_node.crt")
        key_file = os.path.join(ssl_dir, "private_full_node.key")

    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        ssl_dir = "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node"
        cert_file = os.path.join(ssl_dir, "private_full_node.crt")
        key_file = os.path.join(ssl_dir, "private_full_node.key")
        
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        raise Exception(f"SSL-сертификаты Full Node полностью отсутствуют в системе.")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.load_cert_chain(certfile=cert_file, keyfile=key_file)
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8'), 
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
    )
    with urllib.request.urlopen(req, context=ctx) as response:
        return json.loads(response.read().decode('utf-8'))

def main():
    if len(sys.argv) < 6:
        print(json.dumps({"status": "error", "message": "Missing arguments"}))
        sys.exit(1)

    wallet_pk_hex = sys.argv[1]
    sender_ph_hex = sys.argv[2]
    target_address_hex = sys.argv[3]
    amount = int(sys.argv[4])
    fee = int(sys.argv[5])

    try:
        sender_ph = bytes.fromhex(sender_ph_hex)
        target_ph = bytes.fromhex(target_address_hex)

        # Форматируем префикс строго для RPC ноды
        rpc_sender_ph = f"0x{sender_ph_hex}" if not sender_ph_hex.startswith("0x") else sender_ph_hex

        # 1. Запрашиваем доступные монеты
        rpc_response = call_rpc("get_coin_records_by_puzzle_hash", {
            "puzzle_hash": rpc_sender_ph,
            "include_spent_coins": False
        })

        if not rpc_response.get("success"):
            print(json.dumps({"status": "error", "message": f"RPC Error: {rpc_response}"}))
            return

        coin_records = rpc_response.get("coin_records", [])
        if not coin_records:
            print(json.dumps({"status": "error", "message": "На адресе нет доступных монет (баланс 0)."}))
            return

        total_needed = amount + fee
        selected_coins = []
        selected_amount = 0
        
        # Собираем список монет в удобном формате словарей для отправки обратно в Next.js
        coins_json_list = []

        for cr in coin_records:
            if not cr.get("spent"):
                c_data = cr["coin"]
                parent_info = c_data["parent_coin_info"]
                p_hash = c_data["puzzle_hash"]
                if parent_info.startswith("0x"): parent_info = parent_info[2:]
                if p_hash.startswith("0x"): p_hash = p_hash[2:]

                coin_obj = Coin(
                    bytes.fromhex(parent_info),
                    bytes.fromhex(p_hash),
                    int(c_data["amount"])
                )
                selected_coins.append(coin_obj)
                
                # Добавляем в json-структуру
                coins_json_list.append({
                    "parent_coin_info": parent_info,
                    "puzzle_hash": p_hash,
                    "amount": int(c_data["amount"])
                })
                
                selected_amount += coin_obj.amount
                if selected_amount >= total_needed:
                    break

        if selected_amount < total_needed:
            print(json.dumps({"status": "error", "message": f"Недостаточно баланса. Нужно {total_needed} mojo, есть {selected_amount} mojo"}))
            return

        primary_coin = selected_coins[0]

        # 2. Вычисляем delegated_puzzle_hash
        sha256 = hashlib.sha256()
        sha256.update(b"\x33" + target_ph + amount.to_bytes(8, byteorder="big"))
        
        change_amount = selected_amount - total_needed
        if change_amount > 0:
            sha256.update(b"\x33" + sender_ph + change_amount.to_bytes(8, byteorder="big"))
            
        delegated_puzzle_hash = sha256.digest()

        # 3. Вычисляем финальный хеш сообщения для подписи (agg_sig_me)
        coin_id = primary_coin.name()
        hasher = hashlib.sha256()
        hasher.update(delegated_puzzle_hash + coin_id + TESTNET11_GENESIS_CHALLENGE)
        final_message_hash = hasher.digest()

        # Возвращаем чистые данные без оберток SpendBundle
        print(json.dumps({
            "status": "success",
            "message_hash_hex": final_message_hash.hex(),
            "selected_coins": coins_json_list,
            "change_amount": change_amount
        }))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))

if __name__ == "__main__":
    main()
