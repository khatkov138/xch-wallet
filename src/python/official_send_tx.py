import os
import json
import random
import requests
import urllib3
from pathlib import Path

# Чистое нативное Rust-ядро chia_rs
from chia_rs import AugSchemeMPL, PrivateKey, G1Element, G2Element, Coin, CoinSpend, SpendBundle, Program

# Базовые утилиты Chia
from chia.util.bech32m import decode_puzzle_hash
from chia.util.keychain import mnemonic_to_seed
from chia.wallet.derive_keys import master_sk_to_wallet_sk_unhardened
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    puzzle_for_pk, 
    solution_for_conditions, 
    calculate_synthetic_secret_key,
    DEFAULT_HIDDEN_PUZZLE_HASH  # 🔥 ГЛАВНЫЙ ФИКС: Используем эталонный хэш консенсуса Chia
)
from chia.wallet.puzzles.puzzle_utils import make_create_coin_condition
from chia.types.blockchain_format.program import Program as PyProgram

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
BASE_RPC_URL = "https://localhost:8555"

def get_ssl_credentials():
    home_dir = Path.home()
    for folder in ["testnet11", "mainnet"]:
        cert_path = home_dir / ".chia" / folder / "config" / "ssl" / "full_node" / "private_full_node.crt"
        key_path = home_dir / ".chia" / folder / "config" / "ssl" / "full_node" / "private_full_node.key"
        if cert_path.exists() and key_path.exists():
            return str(cert_path), str(key_path)
    return "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.crt", "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.key"

def fetch_genesis_challenge_original(cert, key):
    response = requests.post(f"{BASE_RPC_URL}/get_block_record_by_height", json={"height": 0}, cert=(cert, key), verify=False)
    data = response.json()
    if not data.get("success"): raise ValueError(f"Ошибка RPC: {data.get('error')}")
    genesis_hex = data.get("block_record", {}).get("prev_hash")
    return bytes.fromhex(genesis_hex[2:] if genesis_hex.startswith("0x") else genesis_hex)

if __name__ == "__main__":
    print("=" * 80)
    print("🚀 RAW WALLET SYSTEM: ФИНАЛЬНЫЙ РАБОЧИЙ ВАРИАНТ ТРАНЗАКЦИИ CHIA")
    print("=" * 80)
    
    MNEMONIC = (
        "material harvest garage wish seed possible item solar zero pupil off saddle "
        "glass dial burden desk apology wrap ivory work need favorite tilt burden"
    )
    
    SEND_FROM_INDEX = 175  
    SEND_TO_ADDRESS = "txch1eu3qhduca2g73pytvdfwcd0agfyz3drkl2k58ez4f5w2uud46udqhtywt3" 
    
    MOJOS_TO_SEND = 5_000_000_000  
    FEE_MOJOS = 100_000_000  
    
    try:
        cert_path, key_path = get_ssl_credentials()
        genesis_challenge = fetch_genesis_challenge_original(cert_path, key_path)
        print(f"✅ Сетевой Genesis Challenge получен: 0x{genesis_challenge.hex()[:10]}...")
        
        # 1. Генерация ключей кошелька
        seed = mnemonic_to_seed(MNEMONIC)
        master_sk = AugSchemeMPL.key_gen(seed)
        source_sk = master_sk_to_wallet_sk_unhardened(master_sk, SEND_FROM_INDEX)
        source_pk = G1Element.from_bytes(bytes(source_sk.get_g1()))
        
        # 🔥 ФИКС: Вычисляем правильный Синтетический Секретный Ключ на базе константы сети
        synthetic_sk = calculate_synthetic_secret_key(source_sk, DEFAULT_HIDDEN_PUZZLE_HASH)
        
        py_puzzle = puzzle_for_pk(source_pk)
        source_puzzle_hash = py_puzzle.get_tree_hash()
        
        # 2. Получение монеты из блокчейна
        url = f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hash"
        payload = {"puzzle_hash": source_puzzle_hash.hex(), "include_spent_coins": False}
        res = requests.post(url, json=payload, cert=(cert_path, key_path), verify=False).json()
        
        coin_records = res.get("coin_records", [])
        if not coin_records: raise ValueError("Нет доступных монет на этом адресе!")
            
        # Используем строго 0-ю монету, как вы просили
        c_data = coin_records[0]["coin"]
        coin_to_spend = Coin(
            bytes.fromhex(c_data["parent_coin_info"][2:] if c_data["parent_coin_info"].startswith("0x") else c_data["parent_coin_info"]),
            bytes.fromhex(c_data["puzzle_hash"][2:] if c_data["puzzle_hash"].startswith("0x") else c_data["puzzle_hash"]),
            c_data["amount"]
        )
        print(f"✅ Монета #0 выбрана: ID={coin_to_spend.name().hex()[:10]}... | Баланс={coin_to_spend.amount / 10**12} XCH")
        
        change_mojos = coin_to_spend.amount - MOJOS_TO_SEND - FEE_MOJOS
        target_puzzle_hash = decode_puzzle_hash(SEND_TO_ADDRESS)
        
        # 3. Условия транзакции
        conditions_list = [make_create_coin_condition(target_puzzle_hash, MOJOS_TO_SEND, [])]
        if change_mojos > 0:
            conditions_list.append(make_create_coin_condition(source_puzzle_hash, change_mojos, []))
            
        # Официальный SDK собирает структуру решения без ошибок кастинга типов
        delegated_puzzle_blueprint = PyProgram.to(conditions_list)
        py_solution = solution_for_conditions(delegated_puzzle_blueprint)
        
        rs_puzzle = Program.from_bytes(bytes(py_puzzle))
        rs_solution = Program.from_bytes(bytes(py_solution))
        coin_spend = CoinSpend(coin_to_spend, rs_puzzle, rs_solution)
        
        # =====================================================================
        # 🎯 ТОЧНЫЙ ХЭШ ИЗ РЕШЕНИЯ ДЛЯ AGG_SIG_ME
        # =====================================================================
        # Извлекаем реальный упакованный кошельком делегированный пазл условий
        actual_delegated_puzzle = py_solution.rest().first()
        expected_msg_from_condition = actual_delegated_puzzle.get_tree_hash()
        
        # Склеиваем полные 96 байт для консенсуса
        message_bytes = expected_msg_from_condition + coin_to_spend.name() + genesis_challenge
        
        print(f"\n⚙️ [КРИПТО] Скомпонованы верные байты подписи:")
        print(f"  └─ Хэш условий (true_puzzle): 0x{expected_msg_from_condition.hex()}")
        print(f"  └─ ID монеты (Coin ID):       0x{coin_to_spend.name().hex()}")
        print(f"  └─ Полный массив подписи:     0x{message_bytes.hex()}")
        print("-" * 80)

        # =====================================================================
        # 🔥 СТАНДАРТНАЯ ПОДПИСЬ ПО СХЕМЕ CHIA
        # =====================================================================
        signature = AugSchemeMPL.sign(synthetic_sk, message_bytes)
        
        g2_sig = G2Element.from_bytes(bytes(signature))
        spend_bundle = SpendBundle([coin_spend], g2_sig)
        
        # 4. JSON структура для отправки в ноду
        sb_json = {
            "coin_spends": [
                {
                    "coin": {
                        "parent_coin_info": "0x" + cs.coin.parent_coin_info.hex(),
                        "puzzle_hash": "0x" + cs.coin.puzzle_hash.hex(),
                        "amount": cs.coin.amount
                    },
                    "puzzle_reveal": "0x" + bytes(cs.puzzle_reveal).hex(),
                    "solution": "0x" + bytes(cs.solution).hex()
                } for cs in spend_bundle.coin_spends
            ],
            "aggregated_signature": "0x" + bytes(spend_bundle.aggregated_signature).hex()
        }

        print("[RPC] Отправляем транзакцию в сеть (push_tx)...")
        push_url = f"{BASE_RPC_URL}/push_tx"
        push_res = requests.post(push_url, json={"spend_bundle": sb_json}, cert=(cert_path, key_path), verify=False).json()
        
        print("\n" + "="*30 + " ОТВЕТ СЕТИ НА ТРАНЗАКЦИЮ " + "="*30)
        print(json.dumps(push_res, indent=4))
        print("="*86)
        
    except Exception as e:
        print(f"\n❌ [ОШИБКА ИСПОЛНЕНИЯ]: {e}")
