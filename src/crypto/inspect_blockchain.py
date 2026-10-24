import os
import ssl
import json
import urllib.request
import sys
from chia.types.blockchain_format.program import Program

COIN_PARENT = "0x6a15aa33761968af437df9f15851ec969b49f81239e1c325c0e34193e9c14896"
NETWORK = "testnet11"

def call_rpc(method: str, data: dict) -> dict:
    url = f"https://localhost:8555/{method}"
    
    # Твой канонический блок поиска путей к SSL Chia
    home_dir = os.environ.get("USERPROFILE") or os.environ.get("HOME") or os.path.expanduser("~") or "C:\\Users\\khatk"
    ssl_dir = os.path.join(home_dir, ".chia", NETWORK, "config", "ssl", "full_node")
    cert_file = os.path.join(ssl_dir, "private_full_node.crt")
    key_file = os.path.join(ssl_dir, "private_full_node.key")
    
    if not os.path.exists(cert_file):
        ssl_dir = os.path.join(home_dir, ".chia", "mainnet", "config", "ssl", "full_node")
        cert_file = os.path.join(ssl_dir, "private_full_node.crt")
        key_file = os.path.join(ssl_dir, "private_full_node.key")
        
    if not os.path.exists(cert_file):
        raise FileNotFoundError(f"SSL сертификаты Chia не найдены по пути: {cert_file}")

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.load_cert_chain(certfile=cert_file, keyfile=key_file)
    
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, context=ctx) as response:
        return json.loads(response.read().decode('utf-8'))

print("\n" + "═"*90)
print("🔍 [СКВОЗНОЙ ИНСПЕКТОР РЕАЛЬНОГО БЛОКЧЕЙНА CHIA]")
print("═"*90)

try:
    print("1. Запрос родительской записи...")
    parent_clean = COIN_PARENT.replace("0x", "")
    response = call_rpc("get_coin_record_by_name", {"name": f"0x{parent_clean}"})
    
    if not response.get("success"):
        raise RuntimeError(f"Нода отклонила запрос: {response.get('error')}")
        
    coin_record = response["coin_record"]
    parent_coin = coin_record["coin"]
    
    print(f"   ✅ Родственник найден! Блок подтверждения траты: {coin_record['spent_block_index']}")
    print(f"   👉 Puzzle Hash родителя: {parent_coin['puzzle_hash']}")
    print(f"   👉 Сумма родителя: {parent_coin['amount']} mojo")
    
    print("\n2. Запрос оригинального блока подтверждения траты (Spend Confirmation)...")
    # Важно: запрашиваем по spent_block_index, так как именно в этот момент родитель создал НАШУ монету
    spend_response = call_rpc("get_puzzle_and_solution", {
        "coin_id": f"0x{parent_clean}",
        "height": coin_record["spent_block_index"]
    })
    
    if not spend_response.get("success"):
        raise RuntimeError(f"Не удалось достать куб рантайма: {spend_response.get('error')}")
        
    coin_solution = spend_response["coin_solution"]
    
    raw_puzzle_hex = coin_solution["puzzle_reveal"].replace("0x", "")
    blockchain_program = Program.from_bytes(bytes.fromhex(raw_puzzle_hex))
    
    print("   ✅ Код пазла успешно извлечен из сети!")
    print("\n3. РАСШИФРОВКА СТРУКТУРЫ КЛЮЧЕЙ ИЗ КАНOНИЧЕСКОГО БЛОКЧЕЙНА:")
    
    uncurry_result = blockchain_program.uncurry()
    if uncurry_result is not None:
        mod, args = uncurry_result
        pk_bytes = bytes(args.first())
        print(f"   👉 Истинный целевой Public Key внутри блокчейна: {pk_bytes.hex()}")
    else:
        print("   ⚠️ Пазл имеет кастомную CLVM структуру.")
        
    print(f"   👉 SHA256Tree Хэш этого пазла из сети: {blockchain_program.get_tree_hash().hex()}")
    
except Exception as audit_err:
    print(f"   ❌ Ошибка аудита блокчейна: {str(audit_err)}")

print("═"*90 + "\n")
