import os
import ssl
import json
import urllib.request
import hashlib
from pydantic import BaseModel, Field
from typing import List, Dict, Any

# Родные рабочие импорты из chia_rs
from chia_rs import G1Element
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_hash_for_pk

# ==========================================
# СХЕМА ВАЛИДАЦИИ
# ==========================================
class Step1Input(BaseModel):
    master_pk_hex: str = Field(..., description="Публичный ключ кошелька, переданный с фронтенда")
    amount: int = Field(0, description="Сумма перевода in mojo")
    fee: int = Field(0, description="Комиссия сети in mojo")
    network: str = Field("testnet11", description="Идентификатор сети")

# ==========================================
# ХЕЛПЕР RPC ВЗАИМОДЕЙСТВИЯ С НОДОЙ
# ==========================================
def call_node_rpc(method: str, data: dict, network: str = "testnet11") -> dict:
    url = f"https://localhost:8555/{method}"
    home_dir = os.environ.get("USERPROFILE") or os.environ.get("HOME") or os.path.expanduser("~") or "C:\\Users\\khatk"
    
    ssl_dir = os.path.join(home_dir, ".chia", network, "config", "ssl", "full_node")
    cert_file = os.path.join(ssl_dir, "private_full_node.crt")
    key_file = os.path.join(ssl_dir, "private_full_node.key")
    
    if not os.path.exists(cert_file):
        ssl_dir = os.path.join(home_dir, ".chia", "mainnet", "config", "ssl", "full_node")
        cert_file = os.path.join(ssl_dir, "private_full_node.crt")
        key_file = os.path.join(ssl_dir, "private_full_node.key")
        
    if not os.path.exists(cert_file):
        raise FileNotFoundError(f"SSL сертификаты Chia не найдены. Путь: {cert_file}")

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

# ==========================================
# ОСНОВНАЯ БИЗНЕС-ЛОГИКА ШАГА 1
# ==========================================
def run_step1(data: Step1Input) -> Dict[str, Any]:
    total_needed = data.amount + data.fee
    
    try:
        # 1. Восстанавливаем объект ключа точно так же, как в get_address.py
        wallet_pk = G1Element.from_bytes(bytes.fromhex(data.master_pk_hex))
    except Exception as e:
        raise ValueError(f"Невалидный public key: {str(e)}")

    # 2. Получаем puzzle hash напрямую из ключа (как в эталоне)
    ph = puzzle_hash_for_pk(wallet_pk)
    target_puzzle_hash_hex = f"0x{ph.hex()}"
    
    # 🚀 ФИКС: Корректно упаковываем хэш в список для пакетного RPC запроса к ноде
    hex_puzzle_hashes = [target_puzzle_hash_hex]

    # 3. Запрашиваем ноду о наличии монет на этом адресе
    node_response = call_node_rpc("get_coin_records_by_puzzle_hashes", {
        "puzzle_hashes": hex_puzzle_hashes,
        "include_spent_coins": False
    }, data.network)

    if not node_response.get("success"):
        raise RuntimeError(f"Нода вернула ошибку: {node_response.get('error')}")

    coin_records = node_response.get("coin_records", [])
    utxos = []
    
    for cr in coin_records:
        if cr.get("spent", False):
            continue
        c = cr["coin"]
        
        p_id_clean = c["parent_coin_info"].replace("0x", "")
        p_hash_clean = c["puzzle_hash"].replace("0x", "")
        amt = int(c["amount"])
        
        # Расчет нативного Coin ID по консенсусу
        amount_bytes = amt.to_bytes(8, byteorder="big")
        cid_bytes = hashlib.sha256(bytes.fromhex(p_id_clean) + bytes.fromhex(p_hash_clean) + amount_bytes).digest()

        utxos.append({
            "parent_coin_info": f"0x{p_id_clean}",
            "puzzle_hash": f"0x{p_hash_clean}",
            "amount": amt,
            "coin_id": f"0x{cid_bytes.hex()}"
        })

    # Сортировка монет (жадный алгоритм)
    utxos.sort(key=lambda x: x["amount"], reverse=True)

    selected_coins = []
    accumulated_amount = 0
    for coin in utxos:
        selected_coins.append(coin)
        accumulated_amount += coin["amount"]
        if accumulated_amount >= total_needed:
            break

    if accumulated_amount < total_needed:
        raise ValueError(f"Недостаточно монет на адресе! Доступно: {accumulated_amount} mojo, требуется: {total_needed} mojo")

    # Сдача летит обратно на этот же puzzle hash
    return {
        "status": "success",
        "sender_puzzle_hash": target_puzzle_hash_hex, 
        "selected_coins": selected_coins,
        "total_selected": accumulated_amount,
        "amount": data.amount,
        "fee": data.fee
    }
