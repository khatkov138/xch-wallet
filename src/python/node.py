import httpx
from fastapi import APIRouter, HTTPException, status
from shared import get_ssl_credentials, BASE_RPC_URL

router = APIRouter(prefix="/api/v1/node", tags=["Node Info"])

@router.get("/fees")
async def get_node_fees():
    """
    Чистый ленивый HTTP-транзит для получения сырых оценок комиссий Chia RPC.
    Вызывается фронтендом по требованию strictly при открытии модалки отправки.
    """
    try:
        crt, key = get_ssl_credentials()
        
        # Целевое время подтверждения в секундах (60с, 300с, 600с)
        target_times = [60, 300, 600]
        # Базовая константная стоимость CLVM cost для транзакции отправки стандартного XCH коина
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
                
            return {
                "success": True,
                "estimates": data.get("estimates", [0, 0, 0]),
                "cost": tx_cost
            }
            
    except (httpx.HTTPError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail=f"Служба блокчейна недоступна. Нет ответа от RPC: {str(e)}"
        )
