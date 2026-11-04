import asyncio, json, os, time
from typing import Dict, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status

app = FastAPI(title="Chia Secure WebSocket Server")
SECRET_BRIDGE_TOKEN = os.getenv("API_SECRET", "LOCAL_DEV_SECRET_TOKEN_998877")

class ConnectionManager:
    def __init__(self):
        self.active_clients: Set[WebSocket] = set()
        self.home_node: WebSocket | None = None
        self.current_node_state: Dict = {"success": False, "type": "NODE_RAW_UPDATE", "status": "WAITING_FOR_NODE_CONNECT"}
        # 🌟 Храним таймстамп последнего живого пакета от домашнего моста
        self.last_heartbeat_time: float = time.time()

    async def trigger_home_fetch(self):
        if self.home_node:
            try:
                await self.home_node.send_json({"type": "REQUEST_FETCH_STATE"})
                print("[📤 WS-СЕРВЕР] Запрошен актуальный стейт у моста")
            except Exception as e: print(f"[⚠️ WS-СЕРВЕР] Ошибка пинга хоум-бриджа: {e}")

    async def connect_home(self, websocket: WebSocket):
        await websocket.accept()
        self.home_node = websocket
        self.last_heartbeat_time = time.time() # Сброс таймера при подключении
        print("[⚡ WS-СЕРВЕР] Домашний скрипт-мост УСПЕШНО АВТОРИЗОВАН!")
        await self.trigger_home_fetch()

    def disconnect_home(self):
        self.home_node = None
        self.current_node_state = {"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"}
        print("[❌ WS-СЕРВЕР] Домашний скрипт-мост отключился.")

    async def connect_client(self, websocket: WebSocket):
        await websocket.accept()
        self.active_clients.add(websocket)
        print(f"[👤 WS-СЕРВЕР] Подключился клиент. Всего онлайн: {len(self.active_clients)}")
        has_state = "blockchain_state" in self.current_node_state
        is_sync = self.current_node_state.get("type") == "NODE_SYNCING_STATUS"
        if not self.current_node_state.get("success") or (not has_state and not is_sync):
            await self.trigger_home_fetch()
        payload = dict(self.current_node_state)
        payload["updatedAt"] = int(time.time() * 1000)
        await websocket.send_json(payload)

    def disconnect_client(self, websocket: WebSocket):
        self.active_clients.discard(websocket)
        print(f"[👤 WS-СЕРВЕР] Клиент отключился. Осталось: {len(self.active_clients)}")

    async def broadcast_to_clients(self, message: Dict):
        message["updatedAt"] = int(time.time() * 1000)
        self.current_node_state = message
        if not self.active_clients: return
        targets = []
        for client in self.active_clients:
            try: await client.send_json(message)
            except Exception: targets.append(client)
        for client in targets: self.disconnect_client(client)

    # 🌟 Фоновый воркер: если мост молчит > 30 сек, принудительно гасим статус
    async def check_dead_mans_switch(self):
        while True:
            await asyncio.sleep(5) # Проверяем каждые 5 секунд
            if self.home_node and (time.time() - self.last_heartbeat_time > 30):
                print("[🚨 TIMEOUT] От моста нет данных более 30 секунд! Сбрасываем кэш...")
                # Переводим стейт в оффлайн и уведомляем всех клиентов
                offline_msg = {"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"}
                await self.broadcast_to_clients(offline_msg)
                # Важно: не разрываем сокет принудительно, вдруг канал просто «завис», 
                # но обновляем стейт памяти, чтобы при F5 выдавать оффлайн

manager = ConnectionManager()

# 🌟 Запускаем воркер таймаута при старте FastAPI приложения
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(manager.check_dead_mans_switch())

@app.websocket("/ws/home-node")
async def websocket_home_node(websocket: WebSocket, token: str = Query(None)):
    if token != SECRET_BRIDGE_TOKEN:
        print(f"[🚨 КРИТ] Попытка взлома! Неверный токен: {token}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="UNAUTHORIZED")
        return
    if manager.home_node is not None:
        await websocket.close(code=4001, reason="ALREADY_CONNECTED")
        return
    await manager.connect_home(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            # 🌟 ОБНОВЛЯЕМ ТАЙМЕР: Любой пришедший JSON (даже пустой/ошибка) означает, что мост дышит
            manager.last_heartbeat_time = time.time()
            
            m_type, net = data.get("type"), data.get("networkName", "unknown")
            peers_count = len(data.get("peersList", []))
            
            if m_type == "NODE_SYNCING_STATUS":
                s = data.get("syncData", {})
                print(f"[🔄 ВХОДЯЩИЙ] Синхронизация ({net}): {s.get('percent', 0)}% (пиров: {peers_count})")
            elif m_type == "NODE_RAW_UPDATE":
                if data.get("error"):
                    print(f"[📥 ВХОДЯЩИЙ] Получен статус ошибки от моста: {data.get('error')}")
                else:
                    peak = (data.get("blockchain_state") or {}).get("peak") or {}
                    h = peak.get("height", 0) if isinstance(peak, dict) else 0
                    print(f"[📥 ВХОДЯЩИЙ] Транзит блока #{h} ({net}) (пиров: {peers_count})")
            else:
                print(f"[❓ WS-СЕРВЕР] Неизвестный тип сообщения: {m_type}")
                
            await manager.broadcast_to_clients(data)
    except WebSocketDisconnect:
        manager.disconnect_home()
        await manager.broadcast_to_clients({"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"})
    except Exception as e:
        print(f"[⚠️ WS-СЕРВЕР] Ошибка сокета ноды: {e}")
        manager.disconnect_home()
        await manager.broadcast_to_clients({"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"})

@app.websocket("/ws/client")
async def websocket_client(websocket: WebSocket):
    await manager.connect_client(websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect: manager.disconnect_client(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=True)
