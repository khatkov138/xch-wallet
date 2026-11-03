import sys
from pathlib import Path

CURRENT_FILE = Path(__file__).resolve()
sys.path.append(str(CURRENT_FILE.parent.parent))

import asyncio
import json
import ssl
import os
import websockets
from shared import get_ssl_credentials

CHIA_WS_URL = "wss://localhost:55400"
VPS_HOST = os.getenv("VPS_HOST", "localhost")
SECRET_BRIDGE_TOKEN = os.getenv("API_SECRET", "LOCAL_DEV_SECRET_TOKEN_998877")

# Зашиваем токен прямо в URL эндпоинта
VPS_WS_URL = f"ws://{VPS_HOST}:8080/ws/home-node?token={SECRET_BRIDGE_TOKEN}"

START_MOD_TIME = os.path.getmtime(CURRENT_FILE)

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

async def bridge_loop():
    ssl_context = create_chia_ssl_context()

    while True:
        print(f"\n[🔄 МОСТ] Попытка открыть постоянные каналы связи...")
        try:
            # Открываем ОБА соединения как долгоживущие. Никаких extra_headers/additional_headers!
            async with websockets.connect(CHIA_WS_URL, ssl=ssl_context, max_size=None) as chia_ws, \
                       websockets.connect(VPS_WS_URL, max_size=None) as vps_ws:
                
                print("[🚀 МОСТ] Отлично! Установлено постоянное сквозное соединение.")

                subscribe_cmd = {
                    "command": "register_service",
                    "target": "daemon",
                    "destination": "daemon",
                    "origin": "my_realtime_bridge",
                    "request_id": "1",
                    "data": {"service": "wallet_ui"}
                }
                await chia_ws.send(json.dumps(subscribe_cmd))
                print("[📝 CHIA] Подписка отправлена. Трансляция активна...")

                async for message in chia_ws:
                    event_data = json.loads(message)
                    command = event_data.get("command")
                    origin = event_data.get("origin")

                    if command == "blockchain_state" or origin == "chia_full_node":
                        raw_state = event_data.get("data", {}).get("blockchain_state", {})
                        if not raw_state:
                            continue

                        sync = raw_state.get("sync", {})
                        peak = raw_state.get("peak", {})
                        current_height = peak.get("height", 0) if peak else 0
                        
                        if sync.get("synced"):
                            target_height = current_height
                            progress_percent = "100.0000"
                        else:
                            tip = sync.get("sync_tip_height", 0)
                            target_height = tip if tip > 0 else current_height
                            progress_percent = f"{((current_height / target_height) * 100):.4f}" if target_height > 0 else "0.0000"

                        clean_payload = {
                            "success": True,
                            "type": "NODE_UPDATE",
                            "data": {
                                "isSynced": bool(sync.get("synced")),
                                "isSyncingMode": bool(sync.get("sync_mode")),
                                "currentHeight": int(current_height),
                                "targetHeight": int(target_height),
                                "progressPercent": str(progress_percent),
                                "difficulty": int(raw_state.get("difficulty", 0)),
                                "networkSpaceTib": str(raw_state.get("space", 0)),
                                "mempoolSize": int(raw_state.get("mempool_size", 0))
                            }
                        }

                        # Теперь пушим в постоянно открытую сессию сокета без переподключений
                        await vps_ws.send(json.dumps(clean_payload))
                        print(f"[➡️ ТРАНСЛЯЦИЯ] Отправлен блок {current_height} -> {progress_percent}%")

        except (websockets.exceptions.ConnectionClosed, OSError) as e:
            print(f"[⚠️ РАЗРЫВ] Канал связи закрылся ({e}). Переподключение всей цепочки через 5 секунд...")
        except Exception as e:
            print(f"[💥 ОШИБКА] Сбой: {e}")
            
        await asyncio.sleep(5)

async def main():
    await asyncio.gather(bridge_loop(), watch_file_reload())

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[🛑 СТОП] Мост остановлен.")
