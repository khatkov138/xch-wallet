import asyncio
import json
import os
import time
from typing import Dict, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status

app = FastAPI(title="Chia Secure WebSocket Server")

SECRET_BRIDGE_TOKEN = os.getenv("API_SECRET", "LOCAL_DEV_SECRET_TOKEN_998877")

class ConnectionManager:
    def __init__(self):
        # Фронтенды (Next.js вкладки), которые слушают статус
        self.active_clients: Set[WebSocket] = set()
        # Постоянное соединение от домашнего скрипта-моста
        self.home_node: WebSocket | None = None
        # Состояние ноды, живущее строго в оперативной памяти (RAM)
        self.current_node_state: Dict = {"success": False, "status": "WAITING_FOR_NODE_CONNECT"}

    async def connect_home(self, websocket: WebSocket):
        await websocket.accept()
        self.home_node = websocket
        print("[⚡ WS-СЕРВЕР] Домашний скрипт-мост УСПЕШНО АВТОРИЗОВАН!")

    def disconnect_home(self):
        self.home_node = None
        self.current_node_state = {"success": False, "error": "NODE_OFFLINE"}
        print("[❌ WS-СЕРВЕР] Домашний скрипт-мост отключился.")

    async def connect_client(self, websocket: WebSocket):
        await websocket.accept()
        self.active_clients.add(websocket)
        print(f"[👤 WS-СЕРВЕР] Подключился клиент сайта. Всего онлайн: {len(self.active_clients)}")
        
        payload = dict(self.current_node_state)
        payload["updatedAt"] = int(time.time() * 1000)
        await websocket.send_json(payload)

    def disconnect_client(self, websocket: WebSocket):
        self.active_clients.discard(websocket)
        print(f"[👤 WS-СЕРВЕР] Клиент отключился. Осталось: {len(self.active_clients)}")

    async def broadcast_to_clients(self, message: Dict):
        """Веерная рассылка обновлений всем клиентам."""
        if not self.active_clients:
            return
        
        message["updatedAt"] = int(time.time() * 1000)
        self.current_node_state = message

        disconnect_targets = []
        for client in self.active_clients:
            try:
                await client.send_json(message)
            except Exception:
                disconnect_targets.append(client)
        for client in disconnect_targets:
            self.disconnect_client(client)

manager = ConnectionManager()

@app.websocket("/ws/home-node")
async def websocket_home_node(websocket: WebSocket, token: str = Query(None)):
    if token != SECRET_BRIDGE_TOKEN:
        print(f"[🚨 КРИТ] Попытка взлома! Неверный токен в URL: {token}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="UNAUTHORIZED")
        return

    if manager.home_node is not None:
        await websocket.close(code=4001, reason="ALREADY_CONNECTED")
        return

    await manager.connect_home(websocket)
    try:
        while True:
            # Ждем входящий JSON от домашнего скрипта-моста
            data = await websocket.receive_json()
            
            # 📊 КРАСИВЫЙ ЛОГ: Достаем информацию о прилетевшем блоке
            node_data = data.get("data", {})
            block_height = node_data.get("currentHeight", "Неизвестно")
            progress = node_data.get("progressPercent", "0.0000")
            print(f"[📥 ВХОДЯЩИЙ] Получен новый блок от дома: #{block_height} (Синхронизация: {progress}%)")
            
            # Рассылаем веером на все открытые Next.js вкладки
            await manager.broadcast_to_clients(data)
            
    except WebSocketDisconnect:
        manager.disconnect_home()
        await manager.broadcast_to_clients({"success": False, "error": "NODE_OFFLINE"})
    except Exception as e:
        print(f"[⚠️ WS-СЕРВЕР] Ошибка сокета ноды: {e}")
        manager.disconnect_home()
        await manager.broadcast_to_clients({"success": False, "error": "NODE_OFFLINE"})

@app.websocket("/ws/client")
async def websocket_client(websocket: WebSocket):
    await manager.connect_client(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_client(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=True)
