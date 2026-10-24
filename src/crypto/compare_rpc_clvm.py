import os
import ssl
import json
import urllib.request
import sys
from chia.types.blockchain_format.program import Program

NETWORK = "testnet11"
MY_ADDRESS = "txch12dza3pwr4gzyfxgvl04tlu67nlhw5yv86sx3snkqr0tck2ss4uns4fqh9w"

def call_wallet_rpc(method: str, data: dict) -> dict:
    url = f"https://localhost:9256/{method}"
    home_dir = os.environ.get("USERPROFILE") or os.environ.get("HOME") or os.path.expanduser("~") or "C:\\Users\\khatk"
    
    possible_dirs = [
        os.path.join(home_dir, ".chia", NETWORK, "config", "ssl", "wallet"),
        os.path.join(home_dir, ".chia", NETWORK, "config", "ssl", "full_node"),
        os.path.join(home_dir, ".chia", "mainnet", "config", "ssl", "wallet"),
        "C:\\Users\\khatk\\.chia\\testnet11\\config\\ssl\\wallet"
    ]
    
    cert_file, key_file = None, None
    for d in possible_dirs:
        c = os.path.join(d, "private_wallet.crt")
        k = os.path.join(d, "private_wallet.key")
        if os.path.exists(c):
            cert_file, key_file = c, k
            break
            
    if not cert_file:
        for d in possible_dirs:
            c = os.path.join(d, "private_full_node.crt")
            k = os.path.join(d, "private_full_node.key")
            if os.path.exists(c):
                cert_file, key_file = c, k
                break

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.load_cert_chain(certfile=cert_file, keyfile=key_file)
    
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, context=ctx) as response:
        return json.loads(response.read().decode('utf-8'))

print("\n" + "═"*90)
print("📊 [ЭТАЛОННЫЙ СВЕРЩИК CLVM С СИСТЕМНЫМ RPC CHIA]")
print("═"*90)

try:
    print("1. Запрос SpendBundle через нативный send_transaction...")
    # Метод send_transaction стабилен во всех релизах ядра Chia
    tx_data = call_wallet_rpc("send_transaction", {
        "wallet_id": 1,
        "amount": 1000000000000, # 1 XCH
        "fee": 5000000,
        "address": MY_ADDRESS,
        "push_tx": False # 🛑 ВАЖНО: Просто генерируем структуру в памяти, не пуша в блокчейн
    })
    
    if not tx_data.get("success"):
        raise RuntimeError(f"Wallet RPC вернул ошибку: {tx_data.get('error')}")
        
    sb = tx_data["transaction"]["spend_bundle"]
    first_spend = sb["coin_spends"][0]
    
    print("\n✅ ЭТАЛОННАЯ СТРУКТУРА СЛОВАРЯ УСПЕШНО ПОЛУЧЕНА!")
    
    puzzle_reveal = Program.from_bytes(bytes.fromhex(first_spend["puzzle_reveal"].replace("0x", "")))
    solution = Program.from_bytes(bytes.fromhex(first_spend["solution"].replace("0x", "")))
    
    print("\n2. ИСТИННЫЙ PUZZLE REVEAL ИЗ ТВОЕЙ СИСТЕМЫ:")
    print(f"   👉 Tree Hash родного пазла: 0x{puzzle_reveal.get_tree_hash().hex()}")
    
    print("\n3. ИСТИННЫЙ SOLUTION ИЗ ТВОЕЙ СИСТЕМЫ:")
    print(f"   👉 Каноническая упаковка условий: {solution}")
    
except Exception as e:
    print(f" ❌ Ошибка rpc-дебаггера: {str(e)}")

print("═"*90 + "\n")
