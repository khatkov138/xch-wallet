import time
import hashlib
import requests
from fastapi import APIRouter, HTTPException, Query
from chia_rs import G1Element
from chia.util.bech32m import encode_puzzle_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk, DEFAULT_HIDDEN_PUZZLE_HASH
from shared import get_wallet_pk_unhardened, fetch_balances_from_node, TESTNET_PREFIX, BASE_RPC_URL

wallet_router = APIRouter(prefix="/api/wallet", tags=["Wallets Engine"])

@wallet_router.get("/balance")
async def get_wallet_balances(publicKeyHex: str = Query(...), limit: int = Query(200)):
    """
    Эндпоинт для useWalletBalance хука (TanStack Query).
    Генерирует HD-сетку адресов и пачкой собирает текущие балансы.
    """
    try:
        master_pk = G1Element.from_bytes(bytes.fromhex(publicKeyHex.replace("0x", "")))
        puzzle_hashes_map = {}
        address_list = []
        
        # 1. Генерируем матрицу адресов и пустых записей
        for index in range(limit):
            wallet_pk = get_wallet_pk_unhardened(master_pk, index)
            ph = puzzle_for_pk(wallet_pk).get_tree_hash()
            addr = encode_puzzle_hash(ph, TESTNET_PREFIX)
            puzzle_hashes_map[ph.hex()] = index
            
            # Структура IndexRecord для фронтенда
            address_list.append({
                "index": index,
                "address": addr,
                "puzzle_hash": "0x" + ph.hex(),
                "xch": "0.0",
                "mojo": "0",
                "coins": []
            })
        
        # 2. Получаем только живые (непотраченные) монеты для расчета баланса
        try:
            coins = fetch_balances_from_node(puzzle_hashes_map)
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))
        
        total_mojo = 0
        
        # 3. Наполняем структуру данными монеток
        for r in coins:
            c = r["coin"]
            amt, ph_clean = c["amount"], c["puzzle_hash"].replace("0x", "")
            
            if ph_clean in puzzle_hashes_map:
                idx = puzzle_hashes_map[ph_clean]
                total_mojo += amt
                
                address_list[idx]["coins"].append(c)
                current_mojo = int(address_list[idx]["mojo"]) + amt
                address_list[idx]["mojo"] = str(current_mojo)
                address_list[idx]["xch"] = str(current_mojo / 1e12)
                address_list[idx]["has_balance"] = True
                
        return {
            "total_xch": str(total_mojo / 1e12),
            "total_mojo": str(total_mojo),
            "addresses": address_list
        }
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


@wallet_router.get("/transactions")
async def get_wallet_transactions(publicKeyHex: str = Query(...), limit: int = Query(200)):
    """
    Эндпоинт для ActivityList хука.
    Использует фичу include_spent_coins=True, чтобы достать сквозную историю.
    """
    try:
        cert, key = get_ssl_credentials() if "get_ssl_credentials" in globals() else (None, None)
        if not cert:
            # Фолбэк на импорт из shared, если функция лежит там
            from shared import get_ssl_credentials
            cert, key = get_ssl_credentials()
            
        master_pk = G1Element.from_bytes(bytes.fromhex(publicKeyHex.replace("0x", "")))
        puzzle_hashes_map = {}
        
        # 1. Генерируем карту адресов для сопоставления хэшей смарт-контрактов
        for index in range(limit):
            wallet_pk = get_wallet_pk_unhardened(master_pk, index)
            ph = puzzle_for_pk(wallet_pk).get_tree_hash()
            addr = encode_puzzle_hash(ph, TESTNET_PREFIX)
            puzzle_hashes_map[ph.hex()] = addr

        # 2. 🔥 Твой трюк: тащим монеты из ноды вместе со потраченными (spent)
        res = requests.post(
            f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes", 
            json={
                "puzzle_hashes": list(puzzle_hashes_map.keys()), 
                "include_spent_coins": True,
                "start_height": 0
            }, 
            cert=(cert, key), 
            verify=False
        ).json()
        
        if not res.get("success"):
            raise HTTPException(status_code=400, detail=f"Ошибка ноды Chia: {res.get('error')}")

        clean_transactions = []
        coin_records = res.get("coin_records", [])

        # 3. Конвертируем исторические записи монет в понятные фронту действия
        for record in coin_records:
            coin = record["coin"]
            ph_clean = coin["puzzle_hash"].replace("0x", "")
            my_address = puzzle_hashes_map.get(ph_clean)
            
            timestamp = record.get("timestamp", int(time.time()))
            
            # А) Монета потрачена (Деньги улетели или ушли на нашу же сдачу)
            if record.get("spent", False):
                clean_transactions.append({
                    "name": coin["parent_coin_info"][:16],
                    "type": 2,  # Outgoing (Отправлено)
                    "amount": str(coin["amount"] / 1e12),
                    "to_address": my_address,
                    "confirmed_at_time": timestamp
                })
            
            # Б) Монета найдена и не потрачена, либо это чистое начисление (Входящая транзакция)
            else:
                clean_transactions.append({
                    "name": coin["parent_coin_info"][:16],
                    "type": 1,  # Incoming (Получено)
                    "amount": str(coin["amount"] / 1e12),
                    "to_address": my_address,
                    "confirmed_at_time": timestamp
                })

        # Фильтруем и сортируем: самые свежие переводы поднимаем наверх
        clean_transactions.sort(key=lambda x: x["confirmed_at_time"], reverse=True)

        # Отдаем последние 50 записей истории для рендера списка
        return clean_transactions[:50]

    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
