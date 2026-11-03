import httpx
from fastapi import APIRouter, HTTPException, status
from shared import get_ssl_credentials, BASE_RPC_URL

router = APIRouter(prefix="/api/v1/node", tags=["Node Info"])

@router.get("/fees")
async def get_node_fees():
    """
    Чистый ленивый HTTP-транзит для получения сырых оценок комиссий Chia RPC.
    Возвращает сопоставленные тарифы с заложенным временем в секундах.
    """
    try:
        crt, key = get_ssl_credentials()
        
        # Константные временные бакеты ноды Chia
        target_times = [60, 300, 600]
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
            
            # Напрямую связываем секунды и сырые рейты блока на выходе
            return {
                "success": True,
                "cost": tx_cost,
                "tariffs": {
                    "high": {"raw_estimate": raw_estimates[0], "seconds": 60},
                    "medium": {"raw_estimate": raw_estimates[1], "seconds": 300},
                    "low": {"raw_estimate": raw_estimates[2], "seconds": 600}
                }
            }
            
    except (httpx.HTTPError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail=f"Служба блокчейна недоступна. Нет ответа от RPC: {str(e)}"
        )
