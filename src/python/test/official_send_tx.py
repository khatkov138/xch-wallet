import os, json, requests, urllib3
from pathlib import Path
from chia_rs import AugSchemeMPL, PrivateKey, G1Element, G2Element, Coin, CoinSpend, SpendBundle, Program
from chia.util.bech32m import decode_puzzle_hash, encode_puzzle_hash
from chia.util.keychain import mnemonic_to_seed
from chia.wallet.derive_keys import master_sk_to_wallet_sk_unhardened
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk, solution_for_conditions, calculate_synthetic_secret_key, DEFAULT_HIDDEN_PUZZLE_HASH
from chia.wallet.puzzles.puzzle_utils import make_create_coin_condition
from chia.types.blockchain_format.program import Program as PyProgram

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
BASE_RPC_URL = "https://localhost:8555"
TESTNET_PREFIX = "txch"
SCAN_DEPTH = 200

def get_ssl_credentials():
    home = Path.home()
    for f in ["testnet11", "mainnet"]:
        c, k = home / f".chia/{f}/config/ssl/full_node/private_full_node.crt", home / f".chia/{f}/config/ssl/full_node/private_full_node.key"
        if c.exists() and k.exists(): return str(c), str(k)
    return "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.crt", "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.key"

def fetch_genesis(cert, key):
    res = requests.post(f"{BASE_RPC_URL}/get_block_record_by_height", json={"height": 0}, cert=(cert, key), verify=False).json()
    return bytes.fromhex(res["block_record"]["prev_hash"].replace("0x", ""))

if __name__ == "__main__":
    MNEMONIC = "material harvest garage wish seed possible item solar zero pupil off saddle glass dial burden desk apology wrap ivory work need favorite tilt burden"
    SEND_TO_ADDRESS = "txch1eu3qhduca2g73pytvdfwcd0agfyz3drkl2k58ez4f5w2uud46udqhtywt3" 
    MOJOS_TO_SEND, FEE_MOJOS = 5_000_000_000, 100_000_000
    REQUIRED = MOJOS_TO_SEND + FEE_MOJOS
    
    try:
        cert, key = get_ssl_credentials()
        genesis = fetch_genesis(cert, key)
        
        # 1. Генерация матрицы адресов
        seed = mnemonic_to_seed(MNEMONIC)
        master_sk = AugSchemeMPL.key_gen(seed)
        puzzle_hashes_map = {}
        
        for idx in range(SCAN_DEPTH):
            w_sk = master_sk_to_wallet_sk_unhardened(master_sk, idx)
            ph = puzzle_for_pk(G1Element.from_bytes(bytes(w_sk.get_g1()))).get_tree_hash()
            puzzle_hashes_map[ph.hex()] = (idx, encode_puzzle_hash(ph, TESTNET_PREFIX))
            
        # 2. Поиск монет и группировка по адресам
        res = requests.post(f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes", json={"puzzle_hashes": list(puzzle_hashes_map.keys()), "include_spent_coins": False, "start_height": 0}, cert=(cert, key), verify=False).json()
        
        coins_by_address = {}  # {hex_ph: [coin_records]}
        best_coin, best_idx, best_addr = None, -1, ""
        best_amt = -1
        
        for r in res.get("coin_records", []):
            c_data = r["coin"]
            amt, ph_clean = c_data["amount"], c_data["puzzle_hash"].replace("0x", "")
            
            # Группируем монеты для детального вывода
            if ph_clean not in coins_by_address:
                coins_by_address[ph_clean] = []
            coins_by_address[ph_clean].append(c_data)
            
            # Ищем самую большую монету в кошельке для траты
            if amt >= REQUIRED and amt > best_amt:
                best_amt = amt
                best_idx, best_addr = puzzle_hashes_map[ph_clean]
                best_coin = Coin(bytes.fromhex(c_data["parent_coin_info"].replace("0x", "")), bytes.fromhex(ph_clean), amt)
                    
        if not best_coin: raise ValueError("Нет монет для покрытия суммы + комиссии!")
        
        # 🔥 Сбор детальной информации о монетах на выбранном адресе
        selected_ph_hex = best_coin.puzzle_hash.hex()
        address_coins = coins_by_address.get(selected_ph_hex, [])
        total_address_balance = sum(c["amount"] for c in address_coins)
        
        print("=" * 80)
        print(f"🎯 Выбран: Индекс {best_idx:03d} | Адрес: {best_addr}")
        print(f"💰 Всего монет на адресе: {len(address_coins)} | Общий баланс: {total_address_balance / 1e12} XCH")
        print("-" * 80)
        
        # Выводим детализацию по каждой монете на этом адресе
        for num, c in enumerate(address_coins, start=1):
            coin_id_tmp = Coin(bytes.fromhex(c["parent_coin_info"].replace("0x", "")), bytes.fromhex(c["puzzle_hash"].replace("0x", "")), c["amount"]).name().hex()
            is_spent_target = " (ПОЙДЕТ НА ОТПРАВКУ)" if c["amount"] == best_coin.amount and c["parent_coin_info"] == "0x" + best_coin.parent_coin_info.hex() else ""
            print(f"  📦 Монета #{num:02d} ID: {coin_id_tmp[:12]}... | Размер: {c['amount'] / 1e12} XCH ({c['amount']} mojos){is_spent_target}")
        print("=" * 80)
        
        # 3. Деривация и сборка транзакции
        source_sk = master_sk_to_wallet_sk_unhardened(master_sk, best_idx)
        py_puzzle = puzzle_for_pk(G1Element.from_bytes(bytes(source_sk.get_g1())))
        
        change = best_coin.amount - REQUIRED
        conds = [make_create_coin_condition(decode_puzzle_hash(SEND_TO_ADDRESS), MOJOS_TO_SEND, [])]
        if change > 0: conds.append(make_create_coin_condition(py_puzzle.get_tree_hash(), change, []))
            
        py_sol = solution_for_conditions(PyProgram.to(conds))
        coin_spend = CoinSpend(best_coin, Program.from_bytes(bytes(py_puzzle)), Program.from_bytes(bytes(py_sol)))
        
        # 4. Криптография и push_tx
        msg = py_sol.rest().first().get_tree_hash() + best_coin.name() + genesis
        signature = calculate_synthetic_secret_key(source_sk, DEFAULT_HIDDEN_PUZZLE_HASH).sign(msg)
        sb = SpendBundle([coin_spend], G2Element.from_bytes(bytes(signature)))
        
        sb_json = {
            "coin_spends": [{"coin": {"parent_coin_info": "0x" + cs.coin.parent_coin_info.hex(), "puzzle_hash": "0x" + cs.coin.puzzle_hash.hex(), "amount": cs.coin.amount}, "puzzle_reveal": "0x" + bytes(cs.puzzle_reveal).hex(), "solution": "0x" + bytes(cs.solution).hex()} for cs in sb.coin_spends],
            "aggregated_signature": "0x" + bytes(sb.aggregated_signature).hex()
        }

        print("[RPC] push_tx...")
        push_res = requests.post(f"{BASE_RPC_URL}/push_tx", json={"spend_bundle": sb_json}, cert=(cert, key), verify=False).json()
        print(f"Ответ ноды: {json.dumps(push_res)}")
        
    except Exception as e: print(f"❌ Ошибка: {e}")
