import sys, asyncio, json, ssl, os, websockets, httpx
from pathlib import Path
CURRENT_FILE = Path(__file__).resolve()
sys.path.append(str(CURRENT_FILE.parent.parent))
from shared import get_ssl_credentials, BASE_RPC_URL

CHIA_WS_URL, ALLOWED_NETWORKS = "wss://localhost:55400", {"mainnet", "testnet11"}
VPS_HOST = os.getenv("VPS_HOST", "localhost")
SECRET_BRIDGE_TOKEN = os.getenv("API_SECRET", "LOCAL_DEV_SECRET_TOKEN_998877")
VPS_WS_URL = f"ws://{VPS_HOST}:8080/ws/home-node?token={SECRET_BRIDGE_TOKEN}"
START_MOD_TIME = os.path.getmtime(CURRENT_FILE)

def create_chia_ssl_context():
    crt, key = get_ssl_credentials()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.load_cert_chain(certfile=crt, keyfile=key)
    ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE
    return ctx

async def watch_file_reload():
    while True:
        await asyncio.sleep(1)
        if os.path.getmtime(CURRENT_FILE) > START_MOD_TIME:
            print("\n[🔄 RELOAD] Перезапуск моста...")
            os.execv(sys.executable, [sys.executable] + sys.argv)

async def rpc_req(endpoint, key_path, crt_path, timeout=5.0):
    try:
        async with httpx.AsyncClient(verify=False, cert=(crt_path, key_path), timeout=timeout) as c:
            res = await c.post(f"{BASE_RPC_URL}/{endpoint}", json={})
            data = res.json()
            return data if data.get("success") else {}
    except Exception: return {}

async def fetch_peers(crt, key):
    data = await rpc_req("get_connections", key, crt)
    return [{
        "ip": c.get("peer_host", "unknown"), "port": c.get("peer_port", 8444),
        "trafficDownMb": str(round(c.get("bytes_read", 0) / 1048576, 2)),
        "trafficUpMb": str(round(c.get("bytes_written", 0) / 1048576, 2))
    } for c in data.get("connections", []) if c.get("type") == 1]

async def send_state(vps_ws, net_name, raw_state, crt, key, src="STREAM"):
    if not raw_state: return
    sync = raw_state.get("sync") or {}
    peers = await fetch_peers(crt, key)
    if sync.get("sync_mode", False):
        prog, tip = sync.get("sync_progress_height", 0), sync.get("sync_tip_height", 0)
        p = {
            "success": True, "type": "NODE_SYNCING_STATUS", "networkName": net_name, "peersList": peers,
            "syncData": {"progress": prog, "target": tip, "percent": round((prog / tip * 100), 2) if tip > 0 else 0}
        }
    else:
        p = {"success": True, "type": "NODE_RAW_UPDATE", "networkName": net_name, "peersList": peers, "blockchain_state": raw_state}
    await vps_ws.send(json.dumps(p))
    print(f"[{src}] Пуш отправлен. Пиров: {len(peers)}")

async def listen_vps(vps_ws, net_name, crt, key):
    try:
        async for msg in vps_ws:
            if json.loads(msg).get("type") == "REQUEST_FETCH_STATE":
                st = await rpc_req("get_blockchain_state", key, crt, 10.0)
                await send_state(vps_ws, net_name, st.get("blockchain_state") or st, crt, key, "⚡ PUSH")
    except websockets.exceptions.ConnectionClosed: pass

async def handle_stream(chia_ws, vps_ws, net_name, crt, key):
    await chia_ws.send(json.dumps({"command": "register_service", "target": "daemon", "destination": "daemon", "origin": "bridge", "request_id": "1", "data": {"service": "wallet_ui"}}))
    async for msg in chia_ws:
        ev = json.loads(msg)
        if ev.get("command") == "blockchain_state" or ev.get("origin") == "chia_full_node":
            await send_state(vps_ws, net_name, ev.get("data", {}).get("blockchain_state"), crt, key, "STREAM")

async def sync_heartbeat(vps_ws, net_name, crt, key):
    while True:
        await asyncio.sleep(15)
        st = await rpc_req("get_blockchain_state", key, crt, 10.0)
        raw = st.get("blockchain_state")
        if raw:
            src = "⏱️ SYNC_PULSE" if raw.get("sync", {}).get("sync_mode", False) else "⏱️ PEERS_PULSE"
            await send_state(vps_ws, net_name, raw, crt, key, src)

async def bridge_loop():
    while True:
        try:
            crt, key = get_ssl_credentials()
            ctx = create_chia_ssl_context()
            net_data = await rpc_req("get_network_info", key, crt)
            if not net_data: raise RuntimeError("RPC ноды выключен или запускается")
            net_name = net_data.get("network_name")
            if net_name not in ALLOWED_NETWORKS: raise ValueError(f"Сеть '{net_name}' запрещена")
            print(f"[🌐 СЕТЬ] Валидация пройдена: {net_name}")
            async with websockets.connect(CHIA_WS_URL, ssl=ctx, max_size=None) as c_ws, websockets.connect(VPS_WS_URL, max_size=None) as v_ws:
                await asyncio.gather(handle_stream(c_ws, v_ws, net_name, crt, key), listen_vps(v_ws, net_name, crt, key), sync_heartbeat(v_ws, net_name, crt, key))
        except (websockets.exceptions.ConnectionClosed, OSError, httpx.HTTPError, RuntimeError) as e:
            print(f"[⚠️ СБОЙ СВЯЗИ/RPC_DOWN] {e}. Повтор через 5 секунд...")
        except Exception as e: print(f"[💥 КРИТ_ОШИБКА] {e}")
        await asyncio.sleep(5)

async def main():
    await asyncio.gather(bridge_loop(), watch_file_reload())

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: print("\n[🛑 СТОП] Мост остановлен.")
