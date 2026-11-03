import sys
from pathlib import Path

CURRENT_FILE = Path(__file__).resolve()
sys.path.append(str(CURRENT_FILE.parent.parent))

import asyncio
import json
import ssl
import os
import websockets
import httpx
from shared import get_ssl_credentials, BASE_RPC_URL

CHIA_WS_URL = "wss://localhost:55400"
VPS_HOST = os.getenv("VPS_HOST", "localhost")
SECRET_BRIDGE_TOKEN = os.getenv("API_SECRET", "LOCAL_DEV_SECRET_TOKEN_998877")

VPS_WS_URL = f"ws://{VPS_HOST}:8080/ws/home-node?token={SECRET_BRIDGE_TOKEN}"
START_MOD_TIME = os.path.getmtime(CURRENT_FILE)

ALLOWED_NETWORKS = {"mainnet", "testnet11"}


def create_chia_ssl_context() -> ssl.SSLContext:
    crt_path, key_path = get_ssl_credentials()
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ssl_context.load_cert_chain(certfile=crt_path, keyfile=key_path)
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    return ssl_context


async def watch_file_reload():
    while True:
        await asyncio.sleep(1)
        try:
            current_mod_time = os.path.getmtime(CURRENT_FILE)
            if current_mod_time > START_MOD_TIME:
                print("\n[🔄 RELOAD] Обнаружено изменение кода! Перезапуск моста...")
                os.execv(sys.executable, [sys.executable] + sys.argv)
        except Exception:
            pass


async def get_network_name_from_rpc(crt_path, key_path) -> str:
    async with httpx.AsyncClient(verify=False, cert=(crt_path, key_path), timeout=4.0) as client:
        res = await client.post(f"{BASE_RPC_URL}/get_network_info", json={})
        data = res.json()
        if data.get("success"):
            return str(data.get("network_name"))
        raise ValueError("Full Node RPC вернул success: false")


async def handle_blockchain_stream(chia_ws, vps_ws, network_name: str):
    subscribe_cmd = {
        "command": "register_service",
        "target": "daemon",
        "destination": "daemon",
        "origin": "my_realtime_bridge",
        "request_id": "1",
        "data": {"service": "wallet_ui"}
    }
    await chia_ws.send(json.dumps(subscribe_cmd))
    print(f"[📝 CHIA] Подписка отправлена. Стрим сырых данных активен.")

    async for message in chia_ws:
        event_data = json.loads(message)
        command = event_data.get("command")
        origin = event_data.get("origin")

        if command == "blockchain_state" or origin == "chia_full_node":
            raw_state = event_data.get("data", {}).get("blockchain_state", {})
            if not raw_state:
                continue

            # Никаких вычислений процентов и флагов. Только сырой стейт + имя сети.
            clean_payload = {
                "success": True,
                "type": "NODE_RAW_UPDATE",
                "networkName": network_name,
                "blockchain_state": raw_state
            }

            await vps_ws.send(json.dumps(clean_payload))
            
            peak = raw_state.get("peak", {})
            current_height = peak.get("height", 0) if peak else 0
            print(f"[➡️ ТРАНСЛЯЦИЯ] Сырой блок {current_height} ({network_name}) проброшен на VPS")


async def bridge_loop():
    while True:
        print(f"\n[🔄 МОСТ] Попытка открыть постоянные каналы связи...")
        try:
            crt_path, key_path = get_ssl_credentials()
            ssl_context = create_chia_ssl_context()

            print("[🌐 СЕТЬ] Запрос имени сети через RPC...")
            network_name = await get_network_name_from_rpc(crt_path, key_path)

            if network_name not in ALLOWED_NETWORKS:
                raise ValueError(f"Сеть '{network_name}' запрещена для трансляции!")

            print(f"[🌐 СЕТЬ] Валидация пройдена: {network_name}. Запускаем каналы связи...")

            async with websockets.connect(CHIA_WS_URL, ssl=ssl_context, max_size=None) as chia_ws, \
                       websockets.connect(VPS_WS_URL, max_size=None) as vps_ws:
                
                print("[🚀 МОСТ] Установлено сквозное соединение.")
                await handle_blockchain_stream(chia_ws, vps_ws, network_name=network_name)

        except (websockets.exceptions.ConnectionClosed, OSError, httpx.HTTPError) as e:
            print(f"[⚠️ РАЗРЫВ/RPC_DOWN] Сбой каналов ({e}). Реконнект через 5 секунд...")
        except ValueError as e:
            print(f"[💥 ВАЛИДАЦИЯ] Критическая ошибка: {e} Переподключение через 5 секунд...")
        except Exception as e:
            print(f"[💥 ОШИБКА] Непредвиденный сбой: {e}")
            
        await asyncio.sleep(5)


async def main():
    await asyncio.gather(bridge_loop(), watch_file_reload())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[🛑 СТОП] Мост остановлен.")
