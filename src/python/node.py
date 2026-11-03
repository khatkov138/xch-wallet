import os
import asyncio
import httpx
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from shared import get_ssl_credentials, BASE_RPC_URL

router = APIRouter(prefix="/api/v1/node", tags=["Node Info"])


@router.get("/status")
async def get_node_status():
    try:
        crt, key = get_ssl_credentials()
        
        async def fetch_rpc(client: httpx.AsyncClient, endpoint: str, payload: dict = None) -> dict:
            try:
                res = await client.post(f"{BASE_RPC_URL}/{endpoint}", json=payload or {})
                data = res.json()
                if not data.get("success"):
                    raise HTTPException(
                        status_code=503, 
                        detail=f"Chia RPC {endpoint} returned success: false"
                    )
                return data
            except (httpx.HTTPError, ValueError):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                    detail=f"Служба блокчейна недоступна. Нет ответа от RPC {endpoint}."
                )

        # Всё строго в секундах: 60с, 300с, 600с
        target_times = [60, 300, 600]
        tx_cost = 18000000  # Базовая стоимость CLVM cost для транзакции отправки XCH

        async with httpx.AsyncClient(verify=False, cert=(crt, key), timeout=4.0) as client:
            try:
                async with asyncio.TaskGroup() as tg:
                    net_task = tg.create_task(fetch_rpc(client, "get_network_info"))
                    state_task = tg.create_task(fetch_rpc(client, "get_blockchain_state"))
                    conn_task = tg.create_task(fetch_rpc(client, "get_connections"))
                    
                    fee_task = tg.create_task(fetch_rpc(client, "get_fee_estimate", {
                        "target_times": target_times,
                        "cost": tx_cost
                    }))
                
                net_data = net_task.result()
                state_data = state_task.result()
                conn_data = conn_task.result()
                fee_data = fee_task.result()
                
            except Exception as e:
                # 🎯 ЖЕЛЕЗНЫЙ ФИКС ДЛЯ FASTAPI: Распаковываем ExceptionGroup вручную
                # Если упал TaskGroup, Python завернет ошибку в BaseExceptionGroup
                if hasattr(e, "exceptions") and e.exceptions:
                    for sub_e in e.exceptions:
                        if isinstance(sub_e, HTTPException):
                            raise sub_e
                # Если это одиночный HTTPException — бросаем его напрямую
                if isinstance(e, HTTPException):
                    raise e
                # Любую другую системную ошибку оборачиваем в чистый 503
                raise HTTPException(status_code=503, detail=f"Ошибка сети блокчейна: {str(e)}")

        estimates = fee_data.get("estimates", [0, 0, 0])
        
        # Гарантированные пороги безопасности (минимальные моджи на единицу cost при пустом мемпуле)
        base_low = 1 * tx_cost
        base_medium = 5 * tx_cost
        base_high = 15 * tx_cost

        # Выводим секунды ("seconds") напрямую
        fee_options = {
            "high": {"mojo": int(max(estimates[0], base_high)), "seconds": 60},
            "medium": {"mojo": int(max(estimates[1], base_medium)), "seconds": 300},
            "low": {"mojo": int(max(estimates[2], base_low)), "seconds": 600}
        }

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
            datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")
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
                "dynamicFees": fee_options,
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
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
