import sys
import json
import urllib.request
import ssl
import os
import base64

from chia.util.bech32m import decode_puzzle_hash
# Используем нативный clvm для безупречного кодирования атомов (чисел и байт)
import clvm

def call_rpc(method, data):
    url = f"https://localhost:8555/{method}"
    home_dir = os.environ.get("USERPROFILE") or os.path.expanduser("~") or os.environ.get("HOME") or "C:\\Users\\khatk"
    network_folder = "testnet11" 
    
    ssl_dir = os.path.join(home_dir, network_folder, "config", "ssl", "full_node")
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
        raise Exception("SSL-сертификаты Full Node полностью отсутствуют в системе.")
    
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

def clvm_encode(val) -> bytes:
    """Использует SExp нативного clvm для генерации 100% валидного байт-кода атома"""
    return clvm.SExp.to(val).as_bin()

def make_cons(left: bytes, right: bytes) -> bytes:
    return b"\xff" + left + right

def ensure_0x(s: str) -> str:
    return f"0x{s.replace('0x', '').strip()}"

def main():
    clean_args = [arg for arg in sys.argv if not arg.startswith("-") and not arg.endswith(".py")]

    if len(clean_args) < 7:
        print(json.dumps({"status": "error", "message": "Missing arguments"}))
        sys.exit(1)

    wallet_pk_hex = clean_args.pop(0).replace("0x", "")
    target_address_text = clean_args.pop(0)
    amount = int(clean_args.pop(0))
    fee = int(clean_args.pop(0))
    sender_ph_hex = clean_args.pop(0).replace("0x", "")
    signature_hex = clean_args.pop(0).replace("0x", "")
    coins_base64 = clean_args.pop(0)

    try:
        sender_ph = bytes.fromhex(sender_ph_hex)
        target_ph = decode_puzzle_hash(target_address_text)
        
        coins_json_str = base64.b64decode(coins_base64).decode('utf-8')
        coins_data = json.loads(coins_json_str)
        selected_amount = sum(int(c["amount"]) for c in coins_data)

        # 1. Упаковка puzzle_reveal
        pubkey_bytes = bytes.fromhex(wallet_pk_hex)
        serialized_pubkey = clvm_encode(pubkey_bytes)
        
        prefix = bytes.fromhex("ff02ffff01ff02ffff03ff0bffff01ff02ffff03ffff09ff05ffff1dff0bffff1effff0bffb1ff808080808080ffff01ff02ff03ffff09ff05ffff1dff0bffff1effff0bffb2ff808080808080ff8080ff0180ffff01ff04ffff04ff04ffff04ff05ffff01ff02ffff03ffff09ff05ffff1dff0bffff1effff0bffb2ff808080808080ff8080ff0180ff808080ffff04ffff01")
        suffix = bytes.fromhex("ff8180ff018080")
        puzzle_reveal_hex = (prefix + serialized_pubkey + suffix).hex()

        # 2. Упаковка решения транзакции через нативный clvm_encode
        c1 = make_cons(clvm_encode(51), make_cons(clvm_encode(target_ph), make_cons(clvm_encode(amount), b"\x80")))
        conditions_list_bytes = make_cons(c1, b"\x80")
        
        change_amount = selected_amount - (amount + fee)
        if change_amount > 0:
            c2 = make_cons(clvm_encode(51), make_cons(clvm_encode(sender_ph), make_cons(clvm_encode(change_amount), b"\x80")))
            conditions_list_bytes = make_cons(c2, conditions_list_bytes)

        delegated_puzzle_bytes = make_cons(clvm_encode(1), conditions_list_bytes)
        solution_bytes = make_cons(b"\x80", make_cons(delegated_puzzle_bytes, b"\x80"))
        solution_hex = solution_bytes.hex()

        # 3. Формируем SpendBundle для RPC
        coin_spends_json = []
        for c in coins_data:
            coin_spends_json.append({
                "coin": {
                    "parent_coin_info": ensure_0x(c['parent_coin_info']),
                    "puzzle_hash": ensure_0x(c['puzzle_hash']),
                    "amount": int(c["amount"])
                },
                "puzzle_reveal": ensure_0x(puzzle_reveal_hex),
                "solution": ensure_0x(solution_hex)
            })

        spend_bundle_dict = {
            "coin_spends": coin_spends_json,
            "aggregated_signature": ensure_0x(signature_hex)
        }
        
        rpc_response = call_rpc("push_tx", {"spend_bundle": spend_bundle_dict})

        if rpc_response.get("success") and rpc_response.get("status") == "SUCCESS":
            print(json.dumps({
                "status": "SUCCESS",
                "tx_id": rpc_response.get("tx_id", "unknown_tx_id")
            }))
        else:
            print(json.dumps({
                "status": "node_response",
                "response": rpc_response
            }))

    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Python runtime error: {str(e)}"}))

if __name__ == "__main__":
    main()
