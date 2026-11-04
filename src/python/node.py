import httpx
from fastapi import APIRouter, HTTPException, status, Query
from shared.config import get_network_config

router = APIRouter(prefix="/api/v1/node", tags=["Node Info"])

# 🛡️ САНИТАРНЫЕ МИНИМУМЫ ДЛЯ ПОЛНОСТЬЮ СИНХРОНИЗИРОВАННОЙ НОДЫ (В МОДЖО)
MIN_HIGH_MOJOS = 250_000_000   # ~0.00025 XCH
MIN_MEDIUM_MOJOS = 50_000_000  # ~0.00005 XCH
MIN_LOW_MOJOS = 10_000_000     # ~0.00001 XCH

@router.get("/fees")
async def get_node_fees(
    network: str = Query(..., pattern="^(mainnet|testnet11)$", description="Target network: mainnet or testnet11")

):
    """
    Получение комиссий Chia RPC с жесткой проверкой статуса синхронизации (Sync Status).
    Если нода не синхронизирована — СТРОГО выбрасывает Error.
    """
    try:
        cfg = get_network_config(network)
        crt, key, rpc_url = cfg["crt"], cfg["key"], cfg["rpc_url"]
        
        target_times = [30, 180, 300]
        tx_cost = 18000000

        async with httpx.AsyncClient(verify=False, cert=(crt, key), timeout=4.0) as client:
            
            # ➡️ ШАГ 1: Проверяем, синхронизирована ли нода с сетью Chia
            state_res = await client.post(f"{rpc_url}/get_blockchain_state", json={})
            if state_res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Не удалось получить статус блокчейна. Нода недоступна."
                )
                
            state_data = state_res.json()
            blockchain_state = state_data.get("blockchain_state", {})
            
            # Извлекаем флаги синхронизации ноды
            is_synced = blockchain_state.get("sync", {}).get("synced", False)
            
            # 💥 КРИТИЧЕСКИЙ ФИКС: Если нода не синхронизирована — выдавать данные НЕЛЬЗЯ!
            if not is_synced:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Нода сети {network} не синхронизирована. Оценки комиссий недостоверны."
                )

            # ➡️ ШАГ 2: Нода синхронизирована, теперь запрашиваем реальный эстимейт комиссий
            res = await client.post(
                f"{rpc_url}/get_fee_estimate", 
                json={"target_times": target_times, "cost": tx_cost}
            )
            
            if res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Ошибка Chia RPC при запросе Fee Estimate."
                )
                
            data = res.json()
            if not data.get("success"):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                    detail=f"Нода вернула success: false. Ошибка: {data.get('error', 'Unknown')}"
                )
            
            estimates_list = data.get("estimates", [])
            
            def get_safe_fee(index: int) -> int:
                if index < len(estimates_list):
                    return int(estimates_list[index])
                return 0

            high_calculated = get_safe_fee(0)
            medium_calculated = get_safe_fee(1)
            low_calculated = get_safe_fee(2)

            return {
                "success": True,
                "network": network,
                "cost": tx_cost,
                "tariffs": {
                    "high": {
                        "fee_mojos": max(high_calculated, MIN_HIGH_MOJOS), 
                        "seconds": target_times,
                        "raw_estimate": high_calculated
                    },
                    "medium": {
                        "fee_mojos": max(medium_calculated, MIN_MEDIUM_MOJOS), 
                        "seconds": target_times,
                        "raw_estimate": medium_calculated
                    },
                    "low": {
                        "fee_mojos": max(low_calculated, MIN_LOW_MOJOS), 
                        "seconds": target_times,
                        "raw_estimate": low_calculated
                    }
                }
            }
            
    except (httpx.HTTPError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail=f"Служба блокчейна Chia недоступна. Код ошибки RPC: {str(e)}"
        )
