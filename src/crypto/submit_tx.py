import sys
import json
import urllib.request
import ssl
import os

# =========================================================================
# ЧИСТЫЙ ИМПОРТ: Только SpendBundle из chia_rs, без clvm и wallet зависимостей
# =========================================================================
from chia_rs import SpendBundle

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

def main():
    try:
        # Читаем данные из stdin, переданные API-роутом Next.js
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"status": "error", "message": "Входной поток stdin пуст"}))
            return

        payload = json.loads(input_data)
        tx_data = payload.get("tx_data")
        signature_hex = payload.get("signature")
        
        # ИСПРАВЛЕНО: Динамически считываем сеть, которую прокинул Next.js роут
        network = payload.get("network", "testnet11")

        if not tx_data or not signature_hex:
            print(json.dumps({"status": "error", "message": "Данные транзакции или подпись отсутствуют в stdin payload"}))
            return

        # ИСПРАВЛЕНО: Убираем "0x" префикс! Для chia_rs сигнатура должна быть ЧИСТЫМ hex (192 символа)
        clean_signature = signature_hex.replace("0x", "")

        # Формируем структуру словаря для нативного парсера SpendBundle
        raw_bundle_dict = {
            "coin_spends": tx_data.get("coin_spends", []),
            "aggregated_signature": clean_signature
        }

        # Вызываем парсер внутри Rust-ядра chia_rs
        spend_bundle = SpendBundle.from_json_dict(raw_bundle_dict)

        # Вычисляем финальный сериализованный словарь для отправки в ноду
        bundle_json = spend_bundle.to_json_dict() if hasattr(spend_bundle, 'to_json_dict') else spend_bundle

        # Отправляем сформированный бандл транзакции напрямую в мемпул ноды через push_tx
        node_response = call_node_rpc("push_tx", {
            "spend_bundle": bundle_json
        }, network)

        # ИСПРАВЛЕНО: Расширена проверка статуса ноды. Нода может вернуть "SUCCESS" или "PENDING"
        is_success = node_response.get("success") is True or node_response.get("status") in ["SUCCESS", "PENDING"]

        # Возвращаем результат обратно в Next.js через stdout
        if is_success:
            print(json.dumps({
                "status": "success",
                "message": "Транзакция успешно добавлена в мемпул ноды!",
                "rpc_response": node_response
            }))
        else:
            print(json.dumps({
                "status": "error",
                "message": f"Ответ мемпула: {node_response.get('status', 'UNKNOWN')}. Подробности: {node_response.get('error', 'Нет деталей')}",
                "rpc_response": node_response
            }))

    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Критический сбой выполнения submit_tx.py: {str(e)}"}))

if __name__ == "__main__":
    main()
