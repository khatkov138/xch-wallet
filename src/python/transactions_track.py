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
    Высокоточный атомарный трекер транзакций Chia с расширенными Spacescan-метриками
    и автоматическим поиском puzzle_hash отправителя (From).
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

        async with httpx.AsyncClient(verify=False, cert=(cert, key), timeout=5.0) as client:
            
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
                        "block_height": None,
                        "amount_mojo": None,
                        "puzzle_hash": None,
                        "parent_puzzle_hash": None,
                        "timestamp": None
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
                    
                    confirmed_height = record.get("confirmed_block_index", 0)
                    if confirmed_height > 0:
                        coin_details = record.get("coin", {})
                        parent_coin_id = coin_details.get("parent_coin_info", "")
                        
                        # 🎯 АТОМАРНЫЙ ЗАПРОС К РОДИТЕЛЬСКОЙ МОНЕТЕ: Узнаем puzzle_hash отправителя
                        parent_puzzle_hash = ""
                        if parent_coin_id:
                            parent_res = await client.post(
                                f"{BASE_RPC_URL}/get_coin_record_by_name",
                                json={"name": clean_hash(parent_coin_id)}
                            )
                            if parent_res.status_code == 200:
                                parent_data = parent_res.json()
                                if parent_data.get("success") and parent_data.get("coin_record"):
                                    parent_puzzle_hash = parent_data["coin_record"].get("coin", {}).get("puzzle_hash", "")

                        return {
                            "success": True,
                            "tx_id": f"0x{clean_tx_id}",
                            "status": "CONFIRMED",
                            "block_height": confirmed_height,
                            "amount_mojo": coin_details.get("amount", 0),
                            "puzzle_hash": coin_details.get("puzzle_hash", ""),
                            "parent_puzzle_hash": parent_puzzle_hash,  # Отдаем фронту для декодирования адреса
                            "timestamp": record.get("timestamp", None)
                        }

            return {
                "success": False,
                "tx_id": f"0x{clean_tx_id}",
                "status": "NOT_FOUND",
                "block_height": None,
                "amount_mojo": None,
                "puzzle_hash": None,
                "parent_puzzle_hash": None,
                "timestamp": None
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
