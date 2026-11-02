import httpx
from fastapi import APIRouter, HTTPException, Request
from shared import get_ssl_credentials, BASE_RPC_URL

transactions_track_router = APIRouter(prefix="", tags=["Transaction Direct Tracker"])

# Константа для перевода из mojo в XCH (1 XCH = 10^12 mojo)
MOJO_TO_XCH = 1_000_000_000_000

@transactions_track_router.get("/api/v1/transactions/track-tx")
async def track_transaction(request: Request):
    try:
        query_params = request.query_params
        tx_id = query_params.get("tx_id") or query_params.get("txId")
        spent_coins_param = query_params.get("spent_coins") or query_params.get("spentCoins")
        
        if not tx_id:
            raise HTTPException(status_code=400, detail="Параметр tx_id обязателен!")

        clean_tx_id = tx_id.replace("0x", "").strip().lower()
        cert, key = get_ssl_credentials()

        # Парсим spent_coins в чистый список хэшей без 0x
        spent_coins = []
        if spent_coins_param:
            spent_coins = [
                c.replace("0x", "").strip().lower() 
                for c in spent_coins_param.split(",") 
                if c.strip()
            ]

        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as client:
            # 1. ШАГ 1: Ищем транзакцию в мемпуле по её TX_ID
            mempool_res = await client.post(
                f"{BASE_RPC_URL}/get_mempool_item_by_tx_id",
                json={"tx_id": clean_tx_id}
            )
            
            mempool_data = {}
            if mempool_res.status_code == 200 and "application/json" in mempool_res.headers.get("content-type", ""):
                try:
                    mempool_data = mempool_res.json()
                except Exception:
                    pass

            if mempool_data.get("success") and "mempool_item" in mempool_data:
                m_item = mempool_data["mempool_item"]
                mempool_fee = float(m_item.get("fee", 0)) / MOJO_TO_XCH
                return {
                    "success": True,
                    "tx_id": f"0x{clean_tx_id}",
                    "status": "IN_MEMPOOL",
                    "message": "Транзакция находится в мемпуле ноды и ожидает включения в блок.",
                    "verification": {
                        "fee_xch": mempool_fee,
                        "status": "PENDING"
                    }
                }

            # 2. ШАГ 2: В мемпуле пусто — проверяем, записал ли блокчейн эти монеты как потраченные
            if spent_coins:
                target_coin = spent_coins[0]
                
                coin_res = await client.post(
                    f"{BASE_RPC_URL}/get_coin_record_by_name",
                    json={"name": target_coin}
                )
                
                coin_data = {}
                if coin_res.status_code == 200 and "application/json" in coin_res.headers.get("content-type", ""):
                    try:
                        coin_data = coin_res.json()
                    except Exception:
                        pass

                if coin_data and coin_data.get("success") and "coin_record" in coin_data:
                    coin_record = coin_data["coin_record"]
                    
                    # Если фулл-нода подтверждает, что монета spent=True — транза запеклась в блокчейн
                    if coin_record.get("spent", False):
                        spent_height = coin_record.get("spent_block_index")
                        
                        # Запрашиваем вообще все монеты, рожденные в этом блоке (обоход ограничений индексации ноды)
                        block_coins_res = await client.post(
                            f"{BASE_RPC_URL}/get_block_coins",
                            json={"height": spent_height}
                        )
                        
                        real_outputs = []
                        if block_coins_res.status_code == 200:
                            block_coins_data = block_coins_res.json()
                            if block_coins_data.get("success") and "coin_records" in block_coins_data:
                                # Фильтруем монеты: ищем дочерние элементы, где parent_coin_info равен нашей spent_coin
                                for record in block_coins_data["coin_records"]:
                                    coin_info = record.get("coin", {})
                                    parent = coin_info.get("parent_coin_info", "").replace("0x", "").lower()
                                    
                                    if parent == target_coin:
                                        amount_xch = float(coin_info.get("amount", 0)) / MOJO_TO_XCH
                                        real_outputs.append({
                                            "amount": amount_xch,
                                            "puzzle_hash": coin_info.get("puzzle_hash")
                                        })

                        return {
                            "success": True,
                            "tx_id": f"0x{clean_tx_id}",
                            "status": "CONFIRMED",
                            "message": f"Транзакция успешно подтверждена в блоке {spent_height}!",
                            "verification": {
                                "block_height": spent_height,
                                "real_blockchain_data_audited": True,
                                "confirmed_outputs": real_outputs,
                                "notice": "Сравните суммы и puzzle_hash из confirmed_outputs с вашим подписанным объектом фронтенда."
                            }
                        }

            # 3. ШАГ 3: Фолбек, если монеты не передали или нода их еще/уже не видит
            return {
                "success": False,
                "tx_id": f"0x{clean_tx_id}",
                "status": "NOT_FOUND",
                "message": "Транзакция не найдена в мемпуле и не подтверждена блокчейном через spent_coins."
            }

    except httpx.HTTPError as he:
        raise HTTPException(status_code=503, detail=f"Служба блокчейна недоступна: {str(he)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")
