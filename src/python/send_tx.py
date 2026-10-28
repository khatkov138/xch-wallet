import json, random, hashlib, requests
from clvm_tools import binutils
from clvm.casts import int_to_bytes
from blspy import AugSchemeMPL

# Чистый импорт из твоих готовых модулей
from get_genesis import get_ssl_credentials, fetch_genesis_challenge, BASE_RPC_URL
from get_keys import get_contract_data, clvm_sha256tree, convertbits, CHARSET
from check_balance import get_raw_coin_records

TARGET_ADDRESS = "txch1672dwg0yrequjxtgqshdrqxpl8nc7rhnuvdj9cg5a5465t35gxrqlzrr9n"
MOJO_PER_XCH = 1_000_000_000_000
MIN_FEE = 100_000_000

def bech32_decode_address(address: str) -> bytes:
    return bytes(convertbits([CHARSET.index(c) for c in address.split("1")[-1][:-6]], 5, 8, False))

def main():
    print("[СТАРТ] Запуск транзакции через модули...")
    cert_path, key_path = get_ssl_credentials()
    
    # 1. Подтягиваем генезис сети и ключи контракта
    genesis_challenge = fetch_genesis_challenge()
    wallet_sk, puzzle_reveal_sexp, contract_puzzle_hash, contract_address = get_contract_data()
    
    # 2. Получаем монеты из модуля баланса
    coin_data = get_raw_coin_records()
    valid_coin = next((record.get("coin") for record in coin_data.get("coin_records", []) if not record.get("spent", True)), None)
    
    if not valid_coin:
        print(f"[ОТКЛОНЕНО] На смарт-контракте пусто! Сначала переведи монеты на адрес: {contract_address}")
        return
        
    coin_amount = int(valid_coin["amount"])
    parent_coin_hex = valid_coin["parent_coin_info"][2:] if valid_coin["parent_coin_info"].startswith("0x") else valid_coin["parent_coin_info"]
    print(f"[МОНЕТА] Найдена монета с балансом: {coin_amount / MOJO_PER_XCH} XCH")
    
    # 3. Математика случайной суммы
    random_xch = random.uniform(0.011111, min(0.022220, (coin_amount - MIN_FEE) / MOJO_PER_XCH))
    send_amount = int(random_xch * MOJO_PER_XCH)
    
    # Рассчитываем сдачу, чтобы не подарить её фермерам
    change_amount = coin_amount - send_amount - MIN_FEE
    
    print(f"[МАТЕМАТИКА] Случайная сумма к отправке: {random_xch:.6f} XCH ({send_amount} mojo)")
    print(f"[МАТЕМАТИКА] Безопасный возврат сдачи на контракт: {change_amount / MOJO_PER_XCH} XCH ({change_amount} mojo)")
    print(f"[МАТЕМАТИКА] Комиссия сети (Fee): {MIN_FEE / MOJO_PER_XCH} XCH")
    
    # 4. Сборка условий Chialisp.
    conditions_str = f"((51 0x{bech32_decode_address(TARGET_ADDRESS).hex()} {send_amount}) (51 0x{contract_puzzle_hash.hex()} {change_amount}))"
    
    # Считаем ID монеты и хэш дерева условий для AGG_SIG_ME
    coin_id = hashlib.sha256(bytes.fromhex(parent_coin_hex) + contract_puzzle_hash + int_to_bytes(coin_amount)).digest()
    message = clvm_sha256tree(binutils.assemble(conditions_str)) + coin_id + genesis_challenge
    
    # Переводим подпись G2Element в байты
    signature_bytes = bytes(AugSchemeMPL.sign(wallet_sk, message))
    
    # 5. Формируем финальный SpendBundle (Исправлено: возвращена правильная структура аргументов solution)
    spend_bundle = {
        "coin_spends": [{
            "coin": {"amount": coin_amount, "parent_coin_info": f"0x{parent_coin_hex}", "puzzle_hash": f"0x{contract_puzzle_hash.hex()}"},
            "puzzle_reveal": f"0x{puzzle_reveal_sexp.as_bin().hex()}",
            "solution": f"0x{binutils.assemble(f'({conditions_str})').as_bin().hex()}"
        }],
        "aggregated_signature": f"0x{signature_bytes.hex()}"
    }
    
    # 6. Отправляем в мемпул ноды
    print("[ОТПРАВКА] Отправляем SpendBundle в мемпул через метод push_tx...")
    result = requests.post(f"{BASE_RPC_URL}/push_tx", json={"spend_bundle": spend_bundle}, cert=(cert_path, key_path), verify=False).json()
    print(f"\n[ОТВЕТ НОДЫ]:\n{json.dumps(result, indent=4, ensure_ascii=False)}")

if __name__ == "__main__":
    main()
