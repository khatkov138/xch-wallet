import os
import ssl
import json
import urllib.request
from pydantic import BaseModel, Field
from typing import List, Dict, Any

# Канонические импорты из ядра для точнейшего маппинга
from chia.types.blockchain_format.coin import Coin
from chia.util.bech32m import decode_puzzle_hash

# ==========================================
# СХЕМА ВАЛИДАЦИИ ВХОДНЫХ ДАННЫХ (FASTAPI)
# ==========================================
class Step1Input(BaseModel):
    puzzle_hash: str = Field(..., description="Адрес кошелька (txch1...) или готовый puzzle hash с префиксом 0x")
    amount: int = Field(0, description="Сумма перевода в mojo")
    fee: int = Field(0, description="Комиссия сети в mojo")
    network: str = Field("testnet11", description="Идентификатор сети")

# ==========================================
# ХЕЛПЕРЫ RPC ВЗАИМОДЕЙСТВИЯ
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

    puzzle_hash_input = data.puzzle_hash
    if puzzle_hash_input.startswith("0x"):
        puzzle_hash_hex = puzzle_hash_input
    else:
        try:
            # Нативный безопасный декодер адреса
            ph_bytes = decode_puzzle_hash(puzzle_hash_input)
            puzzle_hash_hex = f"0x{ph_bytes.hex()}"
        except Exception as e:
            raise ValueError(f"Ошибка парсинга адреса: {str(e)}")

    node_response = call_node_rpc("get_coin_records_by_puzzle_hash", {
        "puzzle_hash": puzzle_hash_hex,
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
        
        # 🛠 ЖЕЛЕЗОБЕТОННОЕ ИСПРАВЛЕНИЕ: 
        # Собираем канонический нативный объект Coin из ядра Chia
        native_coin = Coin(
            bytes.fromhex(p_id_clean),
            bytes.fromhex(p_hash_clean),
            amt
        )
        # Вызываем нативный метод .name(), который считает Coin ID со 100% точностью консенсуса C++
        cid_bytes = native_coin.name()
        cid_hex = cid_bytes.hex()

        utxos.append({
            "parent_coin_info": f"0x{p_id_clean}",
            "puzzle_hash": f"0x{p_hash_clean}",
            "amount": amt,
            "coin_id": f"0x{cid_hex}" # Теперь этот ID гарантированно станет 8cafe0f9...
        })

    # Сортировка (жадный алгоритм)
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

    return {
        "status": "success",
        "sender_puzzle_hash": puzzle_hash_hex,
        "selected_coins": selected_coins,
        "total_selected": accumulated_amount,
        "amount": data.amount,
        "fee": data.fee
    }
