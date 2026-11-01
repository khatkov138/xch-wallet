import os
import asyncio
import httpx
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/v1/node", tags=["Node Info"])
BASE_RPC_URL = "https://localhost:8555"

def get_mainnet_ssl():
    home = Path.home()
    p = home / ".chia/mainnet/config/ssl/full_node"
    crt, key = p / "private_full_node.crt", p / "private_full_node.key"
    
    if not crt.exists() or not key.exists():
        p = Path("C:/Users/khatk/.chia/mainnet/config/ssl/full_node")
        crt, key = p / "private_full_node.crt", p / "private_full_node.key"
        
    if not crt.exists() or not key.exists():
        # Если нет сертификатов — это проблема конфигурации ноды, отдаем 503
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="SSL-сертификаты Full Node отсутствуют в папке mainnet."
        )
    return str(crt), str(key)

@router.get("/status")
async def get_node_status():
    try:
        crt, key = get_mainnet_ssl()
        
        async def fetch_rpc(client: httpx.AsyncClient, endpoint: str) -> dict:
            try:
                res = await client.post(f"{BASE_RPC_URL}/{endpoint}", json={})
                data = res.json()
                if not data.get("success"):
                    # Нода ответила, но вернула внутреннюю ошибку (например, NO_TRANSACTIONS_WHILE_SYNCING)
                    raise HTTPException(status_code=503, detail=f"Chia RPC {endpoint} returned success: false")
                return data
            except (httpx.HTTPError, ValueError):
                # Нода вообще не отвечает на запросы (служба отключена)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                    detail=f"Служба блокчейна недоступна. Нет ответа от RPC {endpoint}."
                )

        async with httpx.AsyncClient(verify=False, cert=(crt, key), timeout=4.0) as client:
            net_data, state_data, conn_data = await asyncio.gather(
                fetch_rpc(client, "get_network_info"),
                fetch_rpc(client, "get_blockchain_state"),
                fetch_rpc(client, "get_connections")
            )

        state = state_data["blockchain_state"]
        sync = state["sync"]
        peak = state["peak"]
        
        current_height = (peak.get("height") if peak else 0) or 0
        
        if sync["synced"]:
            target_height = current_height
            progress_percent = "100.0000"
        else:
            tip = sync.get("sync_tip_height") or 0
            target_height = tip if tip > 0 else current_height
            progress_percent = f"{((current_height / target_height) * 100):.4f}" if target_height > 0 else "0.0000"

        ts = peak.get("timestamp") if peak else None
        peak_time = (
            datetime.utcfromtimestamp(ts).isoformat() + "Z"
            if ts is not None and ts > 0 else None
        )

        full_node_conns = [c for c in conn_data.get("connections", []) if c.get("type") == 1]

        return {
            "success": True,
            "data": {
                "network": net_data["network_name"],
                "isSynced": bool(sync["synced"]),
                "isSyncingMode": bool(sync["sync_mode"]),
                "currentHeight": int(current_height),
                "targetHeight": int(target_height),
                "progressPercent": str(progress_percent),
                "difficulty": int(state.get("difficulty") or 0),
                "networkSpaceTib": str(state.get("space") or 0),
                "peakTime": peak_time,
                "totalPeers": int(len(full_node_conns)),
                "peersList": [
                    {
                        "ip": str(c["peer_host"]),
                        "port": int(c["peer_port"]),
                        "trafficUpMb": f"{((c.get('bytes_written') or 0) / (1024 * 1024)):.2f}",
                        "trafficDownMb": f"{((c.get('bytes_read') or 0) / (1024 * 1024)):.2f}"
                    } for c in full_node_conns
                ]
            }
        }
    except HTTPException as he: 
        raise he
    except Exception as e: 
        # Любые другие непредвиденные ошибки бэкенда тоже заворачиваем в 503 статус для RPC
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
