import sys
import json
import urllib.request
import ssl
import os
import hashlib

# Импортируем только базовые типы chia_rs
from chia_rs import PrivateKey, Coin, G1Element, G2Element
from chia.types.blockchain_format.program import Program
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk
from chia.util.bech32m import decode_puzzle_hash

# Импортируем официальные утилиты для подписи сообщений из экосистемы Chia
try:
    from chia.util.chunks import chunks
    from blspy import PrivateKey as BlsPrivateKey, BasicSchemeMPL
    USE_NATIVE_BLS = True
except ImportError:
    USE_NATIVE_BLS = False

# Канонический официальный 64-символьный Genesis Challenge для Testnet11
GENESIS_CHALLENGE = bytes.fromhex("2bf42c13fa096df6efc2e0b5eddfa76b648b40340ed456536b1b87db9f96ad93")

def call_node_rpc(method: str, data: dict, network: str = "testnet11") -> dict:
    url = f"https://localhost:8555/{method}"
    home_dir = os.environ.get("USERPROFILE") or os.path.expanduser("~") or "C:\\Users\\khatk"
    ssl_dir = os.path.join(home_dir, ".chia", network, "config", "ssl", "full_node")
    cert_file = os.path.join(ssl_dir, "private_full_node.crt")
    key_file = os.path.join(ssl_dir, "private_full_node.key")
    
    if not os.path.exists(cert_file):
        ssl_dir = os.path.join(home_dir, ".chia", "mainnet", "config", "ssl", "full_node")
        cert_file = os.path.join(ssl_dir, "private_full_node.crt")
        key_file = os.path.join(ssl_dir, "private_full_node.key")
        
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

def build_clvm_conditions(target_ph: bytes, amount: int, change_ph: bytes, change_amount: int, fee_mojo: int) -> list:
    conditions = []
    conditions.append(Program.to([51, target_ph, amount]))
    if change_amount > 0:
        conditions.append(Program.to([51, change_ph, change_amount]))
    if fee_mojo > 0:
        conditions.append(Program.to([52, fee_mojo]))
    return conditions

def main():
    try:
        # Читаем параметры JSON потока из stdin от Next.js
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"status": "error", "message": "Входной поток stdin пуст"}))
            return
            
        payload = json.loads(input_data)
        unhardened_sk_hex = payload.get("unhardened_sk")
        target_address = payload.get("target_address")
        amount_mojo = int(payload.get("amount_mojo", 0))
        fee_mojo = int(payload.get("fee_mojo", 0))
        network = payload.get("network", "testnet11")

        if not unhardened_sk_hex or not target_address or amount_mojo <= 0:
            print(json.dumps({"status": "error", "message": "Пропущены обязательные параметры транзакции"}))
            return

        clean_sk_hex = unhardened_sk_hex.strip().replace("0x", "").zfill(64)
        sk_bytes = bytes.fromhex(clean_sk_hex)
        
        # 1. Восстанавливаем приватный и публичный ключ
        wallet_sk = PrivateKey.from_bytes(sk_bytes)
        wallet_pk_bytes = bytes(wallet_sk.get_g1())
        wallet_pk_obj = G1Element.from_bytes(wallet_pk_bytes)
        
        # 2. Генерируем puzzle_reveal Hex
        dynamic_puzzle_program = puzzle_for_pk(wallet_pk_obj)
        puzzle_reveal_hex = "0x" + dynamic_puzzle_program.as_bin().hex()
        
        # Наш оригинальный пазл-хэш из блокчейна ( 0x5345d885... )
        sender_puzzle_hash_hex = "5345d885c3aa0444990cfbeabff35e9feeea1187d40d184ec01bd78b2a10af27"
        sender_puzzle_hash_bytes = bytes.fromhex(sender_puzzle_hash_hex)
        
        target_puzzle_hash_bytes = decode_puzzle_hash(target_address)

        # Запрашиваем монеты по puzzle_hash
        node_response = call_node_rpc("get_coin_records_by_puzzle_hash", {
            "puzzle_hash": "0x" + sender_puzzle_hash_hex,
            "include_spent_coins": False
        }, network)

        if not node_response.get("success"):
            print(json.dumps({"status": "error", "message": f"Ошибка ноды RPC: {node_response}"}))
            return

        coin_records = node_response.get("coin_records", [])
        available_coins = [r["coin"] for r in coin_records if not r["spent"]]
        available_coins.sort(key=lambda x: int(x["amount"]), reverse=True)

        selected_coins = []
        accumulated_balance = 0
        total_required = amount_mojo + fee_mojo

        for coin in available_coins:
            selected_coins.append(coin)
            accumulated_balance += int(coin["amount"])
            if accumulated_balance >= total_required:
                break

        if accumulated_balance < total_required:
            print(json.dumps({
                "status": "error", 
                "message": f"Недостаточно средств. Требуется {total_required} mojo, доступно {accumulated_balance} mojo."
            }))
            return

        change_mojo = accumulated_balance - total_required

        # --- Формирование условий для Основной (Primary) монеты ---
        primary_conditions = build_clvm_conditions(
            target_puzzle_hash_bytes, amount_mojo, 
            sender_puzzle_hash_bytes, change_mojo, fee_mojo
        )
        primary_delegated_puzzle = Program.to((1, primary_conditions))
        
        # Каноническая CLVM структура списка (() delegated_puzzle ())
        primary_solution_hex = "0x" + Program.to([[], primary_delegated_puzzle, []]).as_bin().hex()

        # --- Формирование условий для Дополнительных (Secondary) монет ---
        secondary_delegated_puzzle = Program.to((1, []))
        secondary_solution_hex = "0x" + Program.to([[], secondary_delegated_puzzle, []]).as_bin().hex()

        coin_spends_json_list = []
        signatures = []
        
        for index, coin in enumerate(selected_coins):
            c_amount = int(coin["amount"])
            is_primary = (index == 0)
            
            parent_id = bytes.fromhex(coin["parent_coin_info"].replace("0x", ""))
            p_hash = bytes.fromhex(coin["puzzle_hash"].replace("0x", ""))
            chia_coin_obj = Coin(parent_id, p_hash, c_amount)
            c_id = chia_coin_obj.name()

            current_delegated = primary_delegated_puzzle if is_primary else secondary_delegated_puzzle
            current_solution_hex = primary_solution_hex if is_primary else secondary_solution_hex

            coin_spend_dict = {
                "coin": {
                    "parent_coin_info": "0x" + parent_id.hex(),
                    "puzzle_hash": "0x" + p_hash.hex(),
                    "amount": c_amount
                },
                "puzzle_reveal": puzzle_reveal_hex,
                "solution": current_solution_hex
            }
            coin_spends_json_list.append(coin_spend_dict)

            # Вычисляем истинные 96 байт склейки условий AGG_SIG_ME
            final_msg_bytes = current_delegated.get_tree_hash() + c_id + GENESIS_CHALLENGE

            # ВАЖНО: Используем нативный метод подписи сообщений кошелька Chia.
            # Если доступен оригинальный blspy.BasicSchemeMPL, подписываем им 96 байт напрямую.
            # Иначе эмулируем его на уровне chia_rs, прогоняя 96 байт через sha256.
            if USE_NATIVE_BLS:
                bls_sk = BlsPrivateKey.from_bytes(sk_bytes)
                coin_signature = BasicSchemeMPL.sign(bls_sk, final_msg_bytes)
            else:
                from chia_rs import AugSchemeMPL
                final_msg_hash = hashlib.sha256(final_msg_bytes).digest()
                # Извлекаем G2Element подписи хэша
                coin_signature = AugSchemeMPL.sign(wallet_sk, final_msg_hash)
                
            signatures.append(coin_signature)

        # Агрегируем подписи всех монет бандла в одну точку на кривой G2
        if USE_NATIVE_BLS:
            aggregated_sig = BasicSchemeMPL.aggregate(signatures)
            final_signature_hex = bytes(aggregated_sig).hex()
        else:
            from chia_rs import AugSchemeMPL
            aggregated_sig = AugSchemeMPL.aggregate(signatures)
            final_signature_hex = bytes(aggregated_sig).hex()

        raw_spend_bundle_json = {
            "coin_spends": coin_spends_json_list,
            "aggregated_signature": "0x" + final_signature_hex
        }

        # Отсылаем бандл напрямую в полную ноду через push_tx
        rpc_response = call_node_rpc("push_tx", {
            "spend_bundle": raw_spend_bundle_json
        }, network)

        if rpc_response.get("success") or rpc_response.get("status") in ["SUCCESS", "PENDING"]:
            print(json.dumps({
                "status": "success",
                "message": "ПОЛНЫЙ УСПЕХ: Нода приняла бандл канонической подписи сообщений!",
                "rpc_response": rpc_response
            }))
        else:
            print(json.dumps({
                "status": "error",
                "message": f"Ошибка мемпула при ручной сборке: {rpc_response.get('error')}",
                "rpc_response": rpc_response
            }))

    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Ошибка авто-теста транзакции: {str(e)}"}))

if __name__ == "__main__":
    main()
