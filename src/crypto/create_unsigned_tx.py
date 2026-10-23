import sys
import json
import urllib.request
import ssl
import os
import hashlib

# 1. ИСПРАВЛЕНО: Канонический Genesis Challenge для Testnet11
GENESIS_CHALLENGE = bytes.fromhex("37a90eb5185a9c4439a91ddc98bbadce7b4feba060d50116a067de66bf236615")
BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

def address_to_puzzle_hash(address: str) -> str:
    """Конвертация адреса xch1/txch1 в puzzle_hash без внешних библиотек"""
    if not address.startswith("txch1") and not address.startswith("xch1"):
        raise ValueError("Невалидный префикс адреса")
    parts = address.split("1")
    data_part = parts[-1]
    values = [BECH32_ALPHABET.index(c) for c in data_part if c in BECH32_ALPHABET]
    data = values[:-6]
    acc, bits = 0, 0
    ret = bytearray()
    for value in data:
        acc = (acc << 5) | value
        bits += 5
        while bits >= 8:
            bits -= 8
            ret.append((acc >> bits) & 0xFF)
    return ret.hex()

def call_wallet_rpc(method: str, data: dict) -> dict:
    """Безопасный вызов локального Chia Wallet RPC через SSL сертификаты"""
    url = f"https://localhost:9256/{method}"
    home_dir = os.environ.get("USERPROFILE") or os.path.expanduser("~") or "C:\\Users\\khatk"
    
    ssl_dir = os.path.join(home_dir, ".chia", "testnet11", "config", "ssl", "wallet")
    cert_file = os.path.join(ssl_dir, "private_wallet.crt")
    key_file = os.path.join(ssl_dir, "private_wallet.key")
    
    if not os.path.exists(cert_file):
        ssl_dir = os.path.join(home_dir, ".chia", "mainnet", "config", "ssl", "wallet")
        cert_file = os.path.join(ssl_dir, "private_wallet.crt")
        key_file = os.path.join(ssl_dir, "private_wallet.key")
        
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.load_cert_chain(certfile=cert_file, keyfile=key_file)
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8'), 
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, context=ctx) as response:
        return json.loads(response.read().decode('utf-8'))

def main():
    if len(sys.argv) < 5:
        print(json.dumps({"status": "error", "message": "Недостаточно аргументов командной строки"}))
        sys.exit(1)

    sender_address = sys.argv[1]
    target_address = sys.argv[2]
    amount_mojo = int(sys.argv[3])
    fee_mojo = int(sys.argv[4])

    try:
        target_puzzle_hash = address_to_puzzle_hash(target_address)

        # 2. ИСПРАВЛЕНО: Добавлен обязательный массив 'additions', без которого новая нода падает
        rpc_response = call_wallet_rpc("create_signed_transaction", {
            "wallet_id": 1,
            "amount": amount_mojo,
            "address": target_address,
            "fee": fee_mojo,
            "push_tx": False,
            "additions": [
                {
                    "amount": amount_mojo,
                    "puzzle_hash": "0x" + target_puzzle_hash
                }
            ]
        })

        if not rpc_response.get("success"):
            print(json.dumps({"status": "error", "message": f"Ошибка сборки CLVM через RPC: {rpc_response}"}))
            return

        tx = rpc_response["transaction"] if "transaction" in rpc_response else rpc_response["transactions"]
        if isinstance(tx, list):
            tx = tx[0]
            
        rpc_spend = tx["spend_bundle"]["coin_spends"]
        
        # 3. ИСПРАВЛЕНО: rpc_spend — это массив. Берем строго нулевой элемент для извлечения монеты.
        primary_coin = rpc_spend[0]["coin"]

        # 4. Канонический расчет Coin ID (sha256 от конкатенации полей)
        parent_bytes = bytes.fromhex(primary_coin["parent_coin_info"].replace("0x", ""))
        puzzle_bytes = bytes.fromhex(primary_coin["puzzle_hash"].replace("0x", ""))
        amount_bytes = int(primary_coin["amount"]).to_bytes(8, byteorder="big")
        
        coin_id_bytes = hashlib.sha256(parent_bytes + puzzle_bytes + amount_bytes).digest()
        coin_id_hex = coin_id_bytes.hex()

        # 5. Извлекаем истинный message_hash из истории подписей кошелька
        message_hash_hex = None
        
        if "signing_histories" in rpc_response and len(rpc_response["signing_histories"]) > 0:
            message_hash_hex = rpc_response["signing_histories"][0].get("message_hash", None)
            
        if not message_hash_hex and "signing_histories" in tx and len(tx["signing_histories"]) > 0:
            message_hash_hex = tx["signing_histories"][0].get("message_hash", None)

        if not message_hash_hex:
            # Если нода скрыла историю, отдаем коин ID как резервный ориентир, 
            # но фронтенд должен знать, что подписывать нужно delegated_puzzle
            message_hash_hex = tx.get("name", "").replace("0x", "")

        # 6. Отдаем чистый валидный JSON в консоль для Next.js
        print(json.dumps({
            "status": "success",
            "message_hash_hex": message_hash_hex.replace("0x", ""),
            "tx_data": {
                "coin_id": coin_id_hex,
                "coin_spends": rpc_spend,
                "node_signature": tx["spend_bundle"]["aggregated_signature"].replace("0x", ""),
                "parent_coin_info": primary_coin["parent_coin_info"].replace("0x", ""),
                "puzzle_hash": primary_coin["puzzle_hash"].replace("0x", ""),
                "amount": primary_coin["amount"]
            }
        }, indent=2))

    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Ошибка оффлайн генерации транзакции: {str(e)}"}))

if __name__ == "__main__":
    main()
