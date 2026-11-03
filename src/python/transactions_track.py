import httpx
from fastapi import APIRouter, HTTPException, Query, status
from shared import get_ssl_credentials, BASE_RPC_URL

transactions_track_router = APIRouter(prefix="/api/v1/transactions", tags=["Transaction Direct Tracker"])

def clean_hash(h: str) -> str:
    return h.replace("0x", "").strip().lower()

@transactions_track_router.get("/track-tx")
async def track_transaction(
    tx_id: str = Query(..., alias="txId"),
    target_coin_id: str = Query(..., alias="targetCoinId")
):
    """
    Высокоточный атомарный трекер транзакций Chia.
    
    1. Ищет транзакцию в мемпуле по tx_id (пока она в очереди).
    2. Если в мемпуле пусто (блок запекается) — мгновенно проверяет факт 
       появления созданного коина в блокчейне через /get_coin_record_by_name.
    """
    try:
        clean_tx_id = clean_hash(tx_id)
        clean_coin_id = clean_hash(target_coin_id)
        
        if not clean_tx_id or not clean_coin_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Параметры txId и targetCoinId не могут быть пустыми!"
            )
        
        cert, key = get_ssl_credentials()

        async with httpx.AsyncClient(verify=False, cert=(cert, key), timeout=4.0) as client:
            
            # 🚀 ФАЗА 1: Проверка эфемерного мемпула ноды Chia
            mempool_res = await client.post(
                f"{BASE_RPC_URL}/get_mempool_item_by_tx_id",
                json={"tx_id": clean_tx_id}
            )
            
            if mempool_res.status_code == 200:
                mempool_data = mempool_res.json()
                if mempool_data.get("success") and "mempool_item" in mempool_data:
                    m_item = mempool_data["mempool_item"]
                    return {
                        "success": True,
                        "tx_id": f"0x{clean_tx_id}",
                        "status": "IN_MEMPOOL",
                        "fee_mojo": int(m_item.get("fee", 0)),
                        "block_height": None
                    }

            # ⛓️ ФАЗА 2: Проверка появления созданного коина в реестре ноды
            coin_res = await client.post(
                f"{BASE_RPC_URL}/get_coin_record_by_name",
                json={"name": clean_coin_id}
            )
            
            if coin_res.status_code == 200:
                coin_data = coin_res.json()
                if coin_data.get("success") and coin_data.get("coin_record"):
                    record = coin_data["coin_record"]
                    
                    # ИСТИННЫЙ ИНВАРИАНТ УСПЕХА: Если монета подтверждена в блокчейне
                    confirmed_height = record.get("confirmed_block_index", 0)
                    if confirmed_height > 0:
                        return {
                            "success": True,
                            "tx_id": f"0x{clean_tx_id}",
                            "status": "CONFIRMED",
                            "block_height": confirmed_height
                        }

            # 🕳️ ФАЗА 3: Фолбек (Если транзакции нет в мемпуле и коин не создан -> отказ ноды)
            return {
                "success": False,
                "tx_id": f"0x{clean_tx_id}",
                "status": "NOT_FOUND",
                "block_height": None
            }

    except httpx.HTTPError as he:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail=f"Служба блокчейна недоступна. Ошибка RPC ноды: {str(he)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Внутренний сбой трекера транзакций: {str(e)}"
        )
