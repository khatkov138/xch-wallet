import time
import asyncio
import os
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from typing import Dict

ws_router = APIRouter()
SECRET_BRIDGE_TOKEN = os.getenv("WS_SECRET", "LOCAL_DEV_SECRET_TOKEN_998877")

class ConnectionManager:
    def __init__(self):
        # Клиенты фронтенда: {WebSocket: "network_name"}
        self.active_clients: Dict[WebSocket, str] = {}
        
        # 🚀 ИЗМЕНЕНО: Хранилище под два независимых моста: {"mainnet": WebSocket, "testnet11": WebSocket}
        self.home_nodes: Dict[str, WebSocket] = {}
        
        # Раздельный кэш состояний для изоляции сетей
        self.network_states: Dict[str, Dict] = {
            "mainnet": {"success": False, "type": "NODE_RAW_UPDATE", "error": "WAITING_FOR_NODE_CONNECT"},
            "testnet11": {"success": False, "type": "NODE_RAW_UPDATE", "error": "WAITING_FOR_NODE_CONNECT"}
        }
        # Раздельные хартбиты под каждую сеть для dead-mans-switch
        self.last_heartbeats: Dict[str, float] = {
            "mainnet": time.time(),
            "testnet11": time.time()
        }

    async def trigger_home_fetch(self, network: str):
        # 🚀 ИЗМЕНЕНО: Запрашиваем стейт целенаправленно у моста конкретной сети
        node = self.home_nodes.get(network)
        if node:
            try:
                await node.send_json({"type": "REQUEST_FETCH_STATE"})
                print(f"[📤 WS-СЕРВЕР] Запрошен актуальный стейт у моста сети {network}")
            except Exception as e: 
                print(f"[⚠️ WS-СЕРВЕР] Ошибка пинга бриджа {network}: {e}")

    async def connect_home(self, websocket: WebSocket, network: str):
        # 🚀 ИЗМЕНЕНО: Регистрируем мост в свой сетевой слот
        self.home_nodes[network] = websocket
        self.last_heartbeats[network] = time.time()
        print(f"[⚡ WS-СЕРВЕР] Мост сети {network.upper()} УСПЕШНО АВТОРИЗОВАН!")
        await self.trigger_home_fetch(network)

    def disconnect_home(self, network: str):
        # 🚀 ИЗМЕНЕНО: Изолированное отключение — гасим только ту ноду, которая реально упала
        self.home_nodes.pop(network, None)
        self.network_states[network] = {"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"}
        print(f"[❌ WS-СЕРВЕР] Мост сети {network.upper()} отключился. Вторая сеть не затронута.")

    async def connect_client(self, websocket: WebSocket):
        await websocket.accept()
        self.active_clients[websocket] = "testnet11"
        print(f"[👤 WS-СЕРВЕР] Подключился клиент. Всего онлайн: {len(self.active_clients)}")
        
        current_net = self.active_clients[websocket]
        state = self.network_states[current_net]
        
        has_state = "blockchain_state" in state
        is_sync = state.get("type") == "NODE_SYNCING_STATUS"
        if not state.get("success") or (not has_state and not is_sync):
            await self.trigger_home_fetch(current_net)
            
        payload = dict(state)
        payload["updatedAt"] = int(time.time() * 1000)
        await websocket.send_json(payload)

    def disconnect_client(self, websocket: WebSocket):
        self.active_clients.pop(websocket, None)
        print(f"[👤 WS-СЕРВЕР] Клиент отключился. Осталось: {len(self.active_clients)}")

    async def update_client_network(self, websocket: WebSocket, network: str):
        if network in self.network_states:
            self.active_clients[websocket] = network
            payload = dict(self.network_states[network])
            payload["updatedAt"] = int(time.time() * 1000)
            await websocket.send_json(payload)
            
            # Если у новой сети нет данных, дергаем мост этой конкретной сети
            has_state = "blockchain_state" in self.network_states[network]
            if not self.network_states[network].get("success") and not has_state:
                await self.trigger_home_fetch(network)

    async def broadcast_to_clients(self, message: Dict, specific_network: str):
        message["updatedAt"] = int(time.time() * 1000)
        
        # Сохраняем стейт в пул строго определенной сети
        if specific_network in self.network_states:
            self.network_states[specific_network] = message

        if not self.active_clients: return
        targets = []
        
        for client, client_net in self.active_clients.items():
            # Доставляем блоки только тем пользователям, кто сидит в этой сети
            if client_net != specific_network:
                continue
            try: 
                await client.send_json(message)
            except Exception: 
                targets.append(client)
                
        for client in targets: 
            self.disconnect_client(client)

    async def check_dead_mans_switch(self):
        # 🚀 ИЗМЕНЕНО: Посетевой контроль таймаутов
        while True:
            await asyncio.sleep(5)
            now = time.time()
            for net in list(self.network_states.keys()):
                if net in self.home_nodes and (now - self.last_heartbeats[net] > 30):
                    print(f"[🚨 TIMEOUT] От моста {net.upper()} нет данных более 30 сек! Сбрасываем кэш сети...")
                    offline_msg = {"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"}
                    await self.broadcast_to_clients(offline_msg, specific_network=net)
                    self.home_nodes.pop(net, None)

manager = ConnectionManager()

@ws_router.websocket("/ws/home-node")
async def websocket_home_node(websocket: WebSocket, token: str = Query(None)):
    if token != SECRET_BRIDGE_TOKEN:
        print(f"[🚨 КРИТ] Попытка взлома! Неверный токен: {token}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="UNAUTHORIZED")
        return
        
    await websocket.accept()
    
    # Ждем первое инициализирующее сообщение от моста, чтобы понять, майннет это или тестнет
    try:
        init_msg = await websocket.receive_json()
        net = str(init_msg.get("networkName", "unknown")).lower()
        
        if net not in manager.network_states:
            await websocket.close(code=4000, reason="INVALID_NETWORK")
            return
            
        # Если мост для этой сети уже запущен, закрываем старый дубликат коннекта
        if net in manager.home_nodes:
            try: await manager.home_nodes[net].close(code=4001, reason="ALREADY_CONNECTED")
            except Exception: pass
            
        # Регистрируем мост под его сетью
        await manager.connect_home(websocket, net)
        
        # Обрабатываем первый пакет данных, если он пришел сразу с инициализацией
        if "type" in init_msg:
            manager.last_heartbeats[net] = time.time()
            await manager.broadcast_to_clients(init_msg, specific_network=net)
            
        while True:
            data = await websocket.receive_json()
            manager.last_heartbeats[net] = time.time()
            m_type = data.get("type")
            peers_count = len(data.get("peersList", []))
            
            if m_type == "NODE_SYNCING_STATUS":
                s = data.get("syncData", {})
                print(f"[🔄 ВХОДЯЩИЙ] Синхронизация ({net}): {s.get('percent', 0)}% (пиров: {peers_count})")
            elif m_type == "NODE_RAW_UPDATE":
                if data.get("error"):
                    print(f"[📥 ВХОДЯЩИЙ] Статус ошибки от моста {net}: {data.get('error')}")
                else:
                    peak = (data.get("blockchain_state") or {}).get("peak") or {}
                    h = peak.get("height", 0) if isinstance(peak, dict) else 0
                    print(f"[📥 ВХОДЯЩИЙ] Транзит блока #{h} ({net}) (пиров: {peers_count})")
                    
            await manager.broadcast_to_clients(data, specific_network=net)
            
    except WebSocketDisconnect:
        # Ищем, какая именно сеть оборвалась, и гасим только её
        for network, ws in list(manager.home_nodes.items()):
            if ws == websocket:
                manager.disconnect_home(network)
                await manager.broadcast_to_clients({"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"}, specific_network=network)
                break
    except Exception as e:
        print(f"[⚠️ WS-СЕРВЕР] Ошибка сокета ноды: {e}")
        for network, ws in list(manager.home_nodes.items()):
            if ws == websocket:
                manager.disconnect_home(network)
                await manager.broadcast_to_clients({"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"}, specific_network=network)
                break

@ws_router.websocket("/ws/client")
async def websocket_client(websocket: WebSocket):
    await manager.connect_client(websocket)
    try:
        while True: 
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
                if data.get("action") == "SET_NETWORK":
                    await manager.update_client_network(websocket, data.get("network"))
            except Exception:
                pass
    except WebSocketDisconnect: 
        manager.disconnect_client(websocket)
