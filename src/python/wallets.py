import os, time, httpx, hashlib
from fastapi import APIRouter, HTTPException, Query, Path
from chia_rs import G1Element
from chia.util.bech32m import encode_puzzle_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk
from shared import get_wallet_pk_unhardened, fetch_balances_from_node, TESTNET_PREFIX, BASE_RPC_URL, get_ssl_credentials

wallet_router = APIRouter(prefix="/api/wallet", tags=["Wallets Engine"])

@wallet_router.get("/balance")
async def get_wallet_balances(publicKeyHex: str = Query(...), limit: int = Query(200)):
    try:
        master_pk = G1Element.from_bytes(bytes.fromhex(publicKeyHex.replace("0x", "")))
        puzzle_hashes_map, address_list = {}, []
        
        for index in range(limit):
            ph = puzzle_for_pk(get_wallet_pk_unhardened(master_pk, index)).get_tree_hash()
            puzzle_hashes_map[ph.hex()] = index
            address_list.append({"index": index, "address": encode_puzzle_hash(ph, TESTNET_PREFIX), "puzzle_hash": "0x" + ph.hex(), "xch": "0.0", "mojo": "0", "coins": []})
        
        try: coins = fetch_balances_from_node(puzzle_hashes_map)
        except Exception as e: raise HTTPException(status_code=502, detail=str(e))
        
        total_mojo = 0
        for r in coins:
            c = r["coin"]
            amt, ph_clean = c["amount"], c["puzzle_hash"].replace("0x", "")
            if ph_clean in puzzle_hashes_map:
                idx = puzzle_hashes_map[ph_clean]
                total_mojo += amt
                address_list[idx]["coins"].append(c)
                current_mojo = int(address_list[idx]["mojo"]) + amt
                address_list[idx]["mojo"], address_list[idx]["xch"], address_list[idx]["has_balance"] = str(current_mojo), str(current_mojo / 1e12), True
                
        return {"total_xch": str(total_mojo / 1e12), "total_mojo": str(total_mojo), "addresses": address_list}
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@wallet_router.get("/transactions")
async def get_wallet_transactions(publicKeyHex: str = Query(...), limit: int = Query(200)):
    try:
        cert, key = get_ssl_credentials()
        master_pk = G1Element.from_bytes(bytes.fromhex(publicKeyHex.replace("0x", "")))
        puzzle_hashes_map = {puzzle_for_pk(get_wallet_pk_unhardened(master_pk, idx)).get_tree_hash().hex(): encode_puzzle_hash(puzzle_for_pk(get_wallet_pk_unhardened(master_pk, idx)).get_tree_hash(), TESTNET_PREFIX) for idx in range(limit)}

        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as c:
            res = (await c.post(f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes", json={"puzzle_hashes": list(puzzle_hashes_map.keys()), "include_spent_coins": True, "start_height": 0})).json()
        
        if not res.get("success"): raise HTTPException(status_code=400, detail=f"Ошибка ноды Chia: {res.get('error')}")

        clean_tx = []
        for record in res.get("coin_records", []):
            coin = record["coin"]
            clean_tx.append({
                "name": coin["parent_coin_info"][:16],
                "type": 2 if record.get("spent", False) else 1,
                "amount": str(coin["amount"] / 1e12),
                "to_address": puzzle_hashes_map.get(coin["puzzle_hash"].replace("0x", "")),
                "confirmed_at_time": record.get("timestamp", int(time.time()))
            })

        clean_tx.sort(key=lambda x: x["confirmed_at_time"], reverse=True)
        return clean_tx[:50]
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# 🎯 НАШ НОВЫЙ ТРЕКЕР ДЛЯ СОБСТВЕННОЙ FULL-НОДЫ
@wallet_router.get("/track-tx/{tx_id}")
async def track_transaction_status(tx_id: str = Path(...)):
    try:
        cert, key = get_ssl_credentials()
        clean_tx_id = "0x" + tx_id.replace("0x", "").strip()
        
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as c:
            # 1. Проверяем мемпул вашей ноды: торчит ли транза в pending
            mp = (await c.post(f"{BASE_RPC_URL}/get_mempool_item_by_tx_id", json={"tx_id": clean_tx_id})).json()
            if mp.get("success"):
                return {"success": True, "status": "pending", "message": "Транзакция в мемпуле ноды, ждем включения в блок."}
            
            # 2. Если в мемпуле её уже нет — значит нода её успешно исполнила и удалила из очереди (On-Chain)
            return {"success": True, "status": "confirmed", "message": "Транзакция успешно записана в блокчейн!"}
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e))
