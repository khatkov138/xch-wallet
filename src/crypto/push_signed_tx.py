import sys
import json
import urllib.request
import ssl
import os

def call_full_node_rpc(method: str, data: dict) -> dict:
    """Вызов RPC локальной полной ноды Chia (порт 8555)"""
    url = f"https://localhost:8555/{method}"
    home_dir = os.environ.get("USERPROFILE") or os.path.expanduser("~") or "C:\\Users\\khatk"
    
    # Канонические пути SSL для сети Testnet11
    ssl_dir = os.path.join(home_dir, ".chia", "testnet11", "config", "ssl", "full_node")
    cert_file = os.path.join(ssl_dir, "private_full_node.crt")
    key_file = os.path.join(ssl_dir, "private_full_node.key")
    
    # Резервный фолбэк на Mainnet, если папка Testnet11 отсутствует
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
        # Считываем переданный поток данных из stdin от Next.js
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"status": "error", "message": "Входной поток stdin пуст"}))
            return

        payload = json.loads(input_data)
        tx_data = payload["tx_data"]
        coin_spends = tx_data["coin_spends"]
        
        # ЖЕЛЕЗНОЕ АРХИТЕКТУРНОЕ РЕШЕНИЕ ДЛЯ ОДНОГО СИДА:
        # Так как фингерпринты бэка и фронта совпадают, нода уже сгенерировала
        # идеальную комплексную подпись для ВСЕХ монет (включая сдачу и комиссию).
        # Берем чистую node_signature, исключая рассинхронизацию хэшей AGG_SIG_ME.
        node_signature_hex = tx_data.get("node_signature", "").replace("0x", "")

        spend_bundle = {
            "coin_spends": coin_spends,
            "aggregated_signature": "0x" + node_signature_hex
        }

        # Отправляем сформированный бандл напрямую в Full Node RPC мемпул
        node_response = call_full_node_rpc("push_tx", {
            "spend_bundle": spend_bundle
        })

        status_text = node_response.get("status", "UNKNOWN")
        error_msg = node_response.get("error", "")
        
        is_success = node_response.get("success", False) and status_text == "SUCCESS"

        print(json.dumps({
            "status": "success" if is_success else "error",
            "message": f"Ответ мемпула: {status_text}. Подробности: {error_msg}",
            "rpc_response": node_response
        }, indent=2))

    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Ошибка на этапе push_tx: {str(e)}"}))

if __name__ == "__main__":
    main()
