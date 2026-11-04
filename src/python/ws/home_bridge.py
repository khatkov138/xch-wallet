import sys, asyncio, json, ssl, os, websockets, httpx
from pathlib import Path

CURRENT_FILE = Path(__file__).resolve()
if str(CURRENT_FILE.parent.parent) not in sys.path:
    sys.path.append(str(CURRENT_FILE.parent.parent))

# Конфигурация портов для обеих сетей
NETWORKS_CONFIG = {
    "mainnet": {
        "ws_port": "55402",
        "rpc_port": "8557",
        "dir_name": "real_mainnet"
    },
    "testnet11": {
        "ws_port": "55400",
        "rpc_port": "8555",
        "dir_name": "mainnet" # Стандартная папка чиа для тестнета
    }
}

VPS_HOST = os.getenv("VPS_HOST", "localhost")
SECRET_BRIDGE_TOKEN = os.getenv("WS", "LOCAL_DEV_SECRET_TOKEN_998877")
VPS_WS_URL = f"ws://{VPS_HOST}:8000/ws/home-node?token={SECRET_BRIDGE_TOKEN}"
START_MOD_TIME = os.path.getmtime(CURRENT_FILE)

def create_ssl_context_for_net(dir_name):
    user_home = Path.home()
    crt = user_home / ".chia" / dir_name / "config" / "ssl" / "full_node" / "private_full_node.crt"
    key = user_home / ".chia" / dir_name / "config" / "ssl" / "full_node" / "private_full_node.key"
    
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.load_cert_chain(certfile=str(crt), keyfile=str(key))
    ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE
    return ctx, str(crt), str(key)

async def watch_file_reload():
    while True:
        await asyncio.sleep(1)
        if os.path.getmtime(CURRENT_FILE) > START_MOD_TIME:
            print("\n[🔄 RELOAD] Файл изменен! Перезапуск всего моста...")
            os.execv(sys.executable, [sys.executable] + sys.argv)

async def rpc_req(endpoint, rpc_port, key_path, crt_path, timeout=5.0):
    try:
        url = f"https://localhost:{rpc_port}/{endpoint}"
        async with httpx.AsyncClient(verify=False, cert=(crt_path, key_path), timeout=timeout) as c:
            res = await c.post(url, json={})
            data = res.json()
            return data if data.get("success") else {}
    except Exception: return {}

async def fetch_peers(rpc_port, crt, key):
    data = await rpc_req("get_connections", rpc_port, key, crt)
    return [{
        "ip": c.get("peer_host", "unknown"), "port": c.get("peer_port", 8444),
        "trafficDownMb": str(round(c.get("bytes_read", 0) / 1048576, 2)),
        "trafficUpMb": str(round(c.get("bytes_written", 0) / 1048576, 2))
    } for c in data.get("connections", []) if c.get("type") == 1]

async def send_state(vps_ws, net_name, rpc_port, raw_state, crt, key, src="STREAM"):
    if not raw_state: return
    sync = raw_state.get("sync") or {}
    peers = await fetch_peers(rpc_port, crt, key)
    if sync.get("sync_mode", False):
        prog, tip = sync.get("sync_progress_height", 0), sync.get("sync_tip_height", 0)
        p = {
            "success": True, "type": "NODE_SYNCING_STATUS", "networkName": net_name, "peersList": peers,
            "syncData": {"progress": prog, "target": tip, "percent": round((prog / tip * 100), 2) if tip > 0 else 0}
        }
    else:
        p = {"success": True, "type": "NODE_RAW_UPDATE", "networkName": net_name, "peersList": peers, "blockchain_state": raw_state}
    await vps_ws.send(json.dumps(p))
    print(f"[{net_name.upper()} ➡️ {src}] Пуш отправлен. Пиров: {len(peers)}")

async def listen_vps(vps_ws, net_name, rpc_port, crt, key):
    try:
        async for msg in vps_ws:
            if json.loads(msg).get("type") == "REQUEST_FETCH_STATE":
                st = await rpc_req("get_blockchain_state", rpc_port, key, crt, 10.0)
                await send_state(vps_ws, net_name, rpc_port, st.get("blockchain_state") or st, crt, key, "⚡ PUSH")
    except websockets.exceptions.ConnectionClosed: pass

async def handle_stream(chia_ws, vps_ws, net_name, rpc_port, crt, key):
    await chia_ws.send(json.dumps({"command": "register_service", "target": "daemon", "destination": "daemon", "origin": "bridge", "request_id": "1", "data": {"service": "wallet_ui"}}))
    async for msg in chia_ws:
        ev = json.loads(msg)
        if ev.get("command") == "blockchain_state" or ev.get("origin") == "chia_full_node":
            await send_state(vps_ws, net_name, rpc_port, ev.get("data", {}).get("blockchain_state"), crt, key, "STREAM")

async def sync_heartbeat(vps_ws, net_name, rpc_port, crt, key):
    while True:
        await asyncio.sleep(15)
        st = await rpc_req("get_blockchain_state", rpc_port, key, crt, 10.0)
        raw = st.get("blockchain_state")
        if raw:
            src = "⏱️ SYNC_PULSE" if raw.get("sync", {}).get("sync_mode", False) else "⏱️ PEERS_PULSE"
            await send_state(vps_ws, net_name, rpc_port, raw, crt, key, src)

# Изолированный цикл для конкретной сети
async def single_network_bridge_loop(net_name, config):
    while True:
        try:
            ws_url = f"wss://localhost:{config['ws_port']}"
            ctx, crt, key = create_ssl_context_for_net(config['dir_name'])
            
            net_data = await rpc_req("get_network_info", config['rpc_port'], key, crt)
            if not net_data: raise RuntimeError("Нода не отвечает по RPC")
            
            actual_net_name = net_data.get("network_name")
            if actual_net_name != net_name: 
                raise ValueError(f"Ошибка конфигурации: ожидали {net_name}, нода вернула {actual_net_name}")
                
            print(f"[{net_name.upper()}] Успешное подключение к ноде. Запуск стрима на VPS...")
            
            async with websockets.connect(ws_url, ssl=ctx, max_size=None) as c_ws, websockets.connect(VPS_WS_URL, max_size=None) as v_ws:
                init_state = await rpc_req("get_blockchain_state", config['rpc_port'], key, crt, 10.0)
                if init_state:
                    await send_state(v_ws, net_name, config['rpc_port'], init_state.get("blockchain_state") or init_state, crt, key, "🚀 INIT_PUSH")
                
                await asyncio.gather(
                    handle_stream(c_ws, v_ws, net_name, config['rpc_port'], crt, key), 
                    listen_vps(v_ws, net_name, config['rpc_port'], crt, key), 
                    sync_heartbeat(v_ws, net_name, config['rpc_port'], crt, key)
                )
        except (websockets.exceptions.ConnectionClosed, OSError, httpx.HTTPError, RuntimeError) as e:
            print(f"[⚠️ {net_name.upper()} СБОЙ] Нода оффлайн или ошибка связи: {e}. Повтор через 7 секунд...")
        except Exception as e: 
            print(f"[💥 {net_name.upper()} КРИТ] {e}")
        await asyncio.sleep(7)

async def main():
    # Запускаем таски параллельно для обеих сетей и одну таску контроля перезагрузки файла
    tasks = [
        single_network_bridge_loop(net_name, cfg) 
        for net_name, cfg in NETWORKS_CONFIG.items()
    ]
    tasks.append(watch_file_reload())
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    print("[🚀 МОСТ] Запуск глобального комбайна Mainnet + Testnet11...")
    try: asyncio.run(main())
    except KeyboardInterrupt: print("\n[🛑 СТОП] Мост полностью остановлен.")
