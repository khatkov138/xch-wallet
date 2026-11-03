import httpx
from fastapi import APIRouter, HTTPException, status
from shared import get_ssl_credentials, BASE_RPC_URL

router = APIRouter(prefix="/api/v1/node", tags=["Node Info"])

@router.get("/fees")
async def get_node_fees():
    """
    Чистый ленивый HTTP-транзит для получения сырых оценок комиссий Chia RPC.
    Возвращает сопоставленные тарифы с динамически привязанным временем из единого источника правды.
    """
    try:
        crt, key = get_ssl_credentials()
        
        # 🎯 ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ: Эти секунды летят в ноду и они же вернутся фронтенду
        target_times = [30, 180, 300]
        tx_cost = 18000000  

        async with httpx.AsyncClient(verify=False, cert=(crt, key), timeout=4.0) as client:
            res = await client.post(
                f"{BASE_RPC_URL}/get_fee_estimate", 
                json={
                    "target_times": target_times, 
                    "cost": tx_cost
                }
            )
            data = res.json()
            
            if not data.get("success"):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                    detail="Chia RPC fee estimate returned success: false"
                )
            
            raw_estimates = data.get("estimates", [0, 0, 0])
            
            # Напрямую связываем элементы массивов по индексам. Никакого скрытого рассинхрона!
            return {
                "success": True,
                "cost": tx_cost,
                "tariffs": {
                    "high": {"raw_estimate": raw_estimates[0], "seconds": target_times[0]},
                    "medium": {"raw_estimate": raw_estimates[1], "seconds": target_times[1]},
                    "low": {"raw_estimate": raw_estimates[2], "seconds": target_times[2]}
                }
            }
            
    except (httpx.HTTPError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail=f"Служба блокчейна недоступна. Нет ответа от RPC: {str(e)}"
        )
