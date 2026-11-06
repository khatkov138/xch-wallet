import time
import asyncio
import os
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from typing import Dict, Set

ws_router = APIRouter()
SECRET_BRIDGE_TOKEN = os.getenv("WS_SECRET", "LOCAL_DEV_SECRET_TOKEN_998877")

class ConnectionManager:
    def __init__(self):
        # 👤 Клиенты фронтенда: теперь это просто сет активных WebSocket-соединений
        self.active_clients: Set[WebSocket] = set()
        
        # 🚀 Хранилище под два независимых домашних моста: {"mainnet": WebSocket, "testnet11": WebSocket}
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
        # Запрашиваем стейт целенаправленно у моста конкретной сети
        node = self.home_nodes.get(network)
        if node:
            try:
                await node.send_json({"type": "REQUEST_FETCH_STATE"})
                print(f"[📤 WS-СЕРВЕР] Запрошен актуальный стейт у моста сети {network}")
            except Exception as e: 
                print(f"[⚠️ WS-СЕРВЕР] Ошибка пинга бриджа {network}: {e}")

    async def connect_home(self, websocket: WebSocket, network: str):
        self.home_nodes[network] = websocket
        self.last_heartbeats[network] = time.time()
        print(f"[⚡ WS-СЕРВЕР] Мост сети {network.upper()} УСПЕШНО АВТОРИЗОВАН!")
        await self.trigger_home_fetch(network)

    def disconnect_home(self, network: str):
        self.home_nodes.pop(network, None)
        self.network_states[network] = {"success": False, "type": "NODE_RAW_UPDATE", "error": "NODE_OFFLINE"}
        # 🚀 ФИКС СЕРВЕРА: Фиксируем время отключения индивидуально для этой сети
        self.network_states[network]["updatedAt"] = int(time.time() * 1000)
        print(f"[❌ WS-СЕРВЕР] Мост сети {network.upper()} отключился. Вторая сеть не затронута.")

    async def connect_client(self, websocket: WebSocket):
        await websocket.accept()
        self.active_clients.add(websocket)
        print(f"[👤 WS-СЕРВЕР] Подключился клиент. Всего онлайн: {len(self.active_clients)}")
        
        # Проверяем, если по сетям еще нет данных, пингуем мосты
        for net in self.network_states.keys():
            state = self.network_states[net]
            has_state = "blockchain_state" in state
            is_sync = state.get("type") == "NODE_SYNCING_STATUS"
            if not state.get("success") or (not has_state and not is_sync):
                await self.trigger_home_fetch(net)
                
        # Сразу шлем новому клиенту полный пакет со ВСЕМИ сетями
        payload = {
            "networks": self.network_states,
            "updatedAt": int(time.time() * 1000)
        }
        await websocket.send_json(payload)

    def disconnect_client(self, websocket: WebSocket):
        self.active_clients.discard(websocket)
        print(f"[👤 WS-СЕРВЕР] Клиент отключился. Осталось: {len(self.active_clients)}")

    async def broadcast_to_clients(self, message: Dict, specific_network: str):
        # 1. Сначала сохраняем стейт в кэш строго определенной сети
        if specific_network in self.network_states:
            # Если пришел статус синхронизации, мержим с существующим blockchain_state, чтобы не затереть блоки
            if message.get("type") == "NODE_SYNCING_STATUS":
                old_state = self.network_states[specific_network].get("blockchain_state")
                self.network_states[specific_network] = message
                if old_state:
                    self.network_states[specific_network]["blockchain_state"] = old_state
            else:
                self.network_states[specific_network] = message

            # 🚀 ФИКС СЕРВЕРА: Фиксируем точное время обновления ИНДИВИДУАЛЬНО для этой сети
            self.network_states[specific_network]["updatedAt"] = int(time.time() * 1000)

        if not self.active_clients: return
        
        # 2. Формируем единый глобальный пакет для фронтенда
        payload = {
            "networks": self.network_states,
            "updatedAt": int(time.time() * 1000)
        }
        
        targets = []
        for client in self.active_clients:
            try: 
                await client.send_json(payload)
            except Exception: 
                targets.append(client)
                
        for client in targets: 
            self.disconnect_client(client)

    async def check_dead_mans_switch(self):
        # Посетевой контроль таймаутов мостов
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

# ==========================================
# 🏡 РОУТ ДЛЯ ДОМАШНИХ МОСТОВ
# ==========================================
@ws_router.websocket("/ws/home-node")
async def websocket_home_node(websocket: WebSocket, token: str = Query(None)):
    if token != SECRET_BRIDGE_TOKEN:
        print(f"[🚨 КРИТ] Попытка взлома! Неверный токен: {token}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="UNAUTHORIZED")
        return
        
    await websocket.accept()
    
    try:
        # Первое сообщение от домашнего моста определяет сеть
        init_msg = await websocket.receive_json()
        net = str(init_msg.get("networkName", "unknown")).lower()
        
        if net not in manager.network_states:
            await websocket.close(code=4000, reason="INVALID_NETWORK")
            return
            
        # Если мост для этой сети уже висит, закрываем старый дубликат
        if net in manager.home_nodes:
            try: await manager.home_nodes[net].close(code=4001, reason="ALREADY_CONNECTED")
            except Exception: pass
            
        await manager.connect_home(websocket, net)
        
        # Если в первом пакете уже были данные, сразу бродкастим их
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
                    # 🚀 ИСПРАВЛЕНО: Убрана опечатка со случайными символами .[1]
                    peak = (data.get("blockchain_state") or {}).get("peak") or {}
                    h = peak.get("height", 0) if isinstance(peak, dict) else 0
                    print(f"[📥 ВХОДЯЩИЙ] Транзит блока #{h} ({net}) (пиров: {peers_count})")
                    
            await manager.broadcast_to_clients(data, specific_network=net)
            
    except WebSocketDisconnect:
        for network_name, ws in list(manager.home_nodes.items()):
            if ws == websocket:
                manager.disconnect_home(network_name)
                break

# ==========================================
# 👤 УПРОЩЕННЫЙ РОУТ ДЛЯ КЛИЕНТОВ (ФРОНТЕНДА)
# ==========================================
@ws_router.websocket("/ws/client")
async def websocket_client(websocket: WebSocket):
    await manager.connect_client(websocket)
    try:
        while True:
            # Удерживаем соединение открытым и ждем события закрытия
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_client(websocket)
