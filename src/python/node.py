import httpx
from fastapi import APIRouter, HTTPException, Query
from shared.config import get_network_config

router = APIRouter(prefix="/api/v1/node", tags=["Node Info"])

@router.get("/fees")
async def get_node_fees(
    network: str = Query(..., pattern="^(mainnet|testnet11)$", description="Target network")
):
    """
    Возвращает базовые готовые комиссии в MOJO для стандартного cost (18,000,000).
    Нижний порог зажат на 100,000,000 mojos, чтобы избежать ошибок TOO_CLOSE_TO_ZERO.
    """
    try:
        cfg = get_network_config(network)
        crt, key, rpc_url = cfg["crt"], cfg["key"], cfg["rpc_url"]
        
        target_times = [30, 180, 300]
        # Запрашиваем цену для стандартного полного веса
        base_cost = 18_000_000

        async with httpx.AsyncClient(verify=False, cert=(crt, key), timeout=4.0) as client:
            
            state_res = await client.post(f"{rpc_url}/get_blockchain_state", json={})
            if state_res.status_code != 200:
                raise HTTPException(status_code=503, detail="Node unavailable")
                
            state_data = state_res.json()
            if not state_data.get("blockchain_state", {}).get("sync", {}).get("synced", False):
                raise HTTPException(status_code=503, detail="Node not synchronized")

            # Запрашиваем оценку в MOJO для полной базовой транзы
            res = await client.post(
                f"{rpc_url}/get_fee_estimate", 
                json={"target_times": target_times, "cost": base_cost}
            )
            
            res_json = res.json()
            if res.status_code != 200 or not res_json.get("success"):
                raise HTTPException(status_code=503, detail="RPC estimate error")
            
            estimates = res_json.get("estimates", [])
            current_fee = int(res_json.get("current_fee_rate", 0)) # на случай если estimates пустой

            raw_high = estimates[0] if len(estimates) > 0 else current_fee
            raw_medium = estimates[1] if len(estimates) > 1 else current_fee
            raw_low = estimates[2] if len(estimates) > 2 else current_fee

            # ЖЕСТКИЙ САНИТАРНЫЙ МИНИМУМ В MOJO (По эталону Chia сети):
            # High: 250 млн (~0.00025 XCH) | Medium: 150 млн (~0.00015 XCH) | Low: 100 млн (~0.0001 XCH)
            # Если мемпул пустой, отдадутся эти железные минимумы. Ошибки LOW_FEE больше не будет.
            return {
                "high": {"fee_mojos": max(int(raw_high), 250_000_000), "seconds": target_times[0]},
                "medium": {"fee_mojos": max(int(raw_medium), 150_000_000), "seconds": target_times[1]},
                "low": {"fee_mojos": max(int(raw_low), 100_000_000), "seconds": target_times[2]}
            }
            
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service failure: {str(e)}")
