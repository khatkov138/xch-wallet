import os
import json
import requests
import urllib3
from clvm_tools.clvmc import compile_clvm_text

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
    try:
        cert_path, key_path = get_ssl_credentials()
        url = f"{BASE_RPC_URL}/get_block_record_by_height"
        response = requests.post(url, json={"height": 0}, cert=(cert_path, key_path), verify=False, timeout=5)
        data = response.json()
        if data.get("success"):
            genesis_hex = data["block_record"]["prev_hash"]
            return genesis_hex[2:] if genesis_hex.startswith("0x") else genesis_hex
    except Exception:
        pass
    # Фоллбэк по умолчанию, если локальная нода выключена в момент компиляции
    return "37a90eb5185a9c4439a91ddc98bbadce7b4feba060d50116a067de66bf236615"

def update_env_file(hex_value: str, genesis_challenge: str, env_path: str):
    constants = {
        "NEXT_PUBLIC_CONTRACT_HEX": f'"{hex_value}"',
        "NEXT_PUBLIC_CHIA_GENESIS_CHALLENGE": f'"{genesis_challenge}"',
        "NEXT_PUBLIC_CHIA_PORT": "12381",
        "NEXT_PUBLIC_CHIA_COIN": "8444",
        "NEXT_PUBLIC_CHIA_CHARSET": '"qpzry9x8gf2tvdw0s3jn54khce6mua7l"',
        "NEXT_PUBLIC_CHIA_GROUP_ORDER": '"0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001"',
        "NEXT_PUBLIC_CHIA_HIDDEN_PUZZLE_HASH": '"711d6c4e32c92e53179b1994a5288a2da05bde7851007a413da9f27dda2c8ceb"'
    }
    
    os.makedirs(os.path.dirname(os.path.abspath(env_path)), exist_ok=True)
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    for var_name, var_value in constants.items():
        new_line = f"{var_name}={var_value}\n"
        var_found = False
        for i, line in enumerate(lines):
            if line.strip().startswith(f"{var_name}="):
                lines[i] = new_line
                var_found = True
                break
        if not var_found:
            if lines and not lines[-1].endswith('\n'):
                lines[-1] = lines[-1] + '\n'
            lines.append(new_line)
        
    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"[УСПЕХ] Константы, хекс контракта и генезис ({genesis_challenge[:8]}...) записаны в {env_path}")

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    clsp_path = os.path.join(current_dir, "signature.clsp")
    if not os.path.exists(clsp_path):
        print(f"[ОШИБКА] Файл контракта не найден: {clsp_path}")
        return
        
    print(f"[КОМПИЛЯЦИЯ] Читаем и компилируем {clsp_path}...")
    try:
        with open(clsp_path, "r", encoding="utf-8") as f:
            chialisp_code = f.read()
        compiled_sexp = compile_clvm_text(chialisp_code, [])
        compiled_hex = compiled_sexp.as_bin().hex()
        print(f"[КОМПИЛЯЦИЯ] Успешно! Длина Hex: {len(compiled_hex)} символов.")
    except Exception as e:
        print(f"[ОШИБКА] Ошибка компиляции Chialisp: {e}")
        return
        
    genesis_challenge = fetch_genesis_challenge()
    env_path = os.path.join(current_dir, "..", "..", ".env") 
    update_env_file(compiled_hex, genesis_challenge, env_path)

if __name__ == "__main__":
    main()
