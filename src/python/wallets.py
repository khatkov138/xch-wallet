import httpx, time
from fastapi import APIRouter, HTTPException, Query
from chia_rs import G1Element
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk
from shared import get_wallet_pk_unhardened, BASE_RPC_URL, get_ssl_credentials

wallet_router = APIRouter(prefix="/api/wallet", tags=["Wallets Engine"])
GAP, MAX_LIM = 40, 1000

async def scan_chunk(master_pk: G1Element, idxs: list[int], client: httpx.AsyncClient) -> dict:
    print(f"🚀 [RPC NODE REQUEST] Сканируем пачку индексов: от {min(idxs)} до {max(idxs)} (Всего: {len(idxs)} адресов)")
    
    ph_map, addrs = {}, []
    for i in idxs:
        ph = puzzle_for_pk(get_wallet_pk_unhardened(master_pk, i)).get_tree_hash()
        ph_hex = ph.hex()
        ph_map[ph_hex] = {"index": i}
        addrs.append({"index": i, "puzzle_hash": f"0x{ph_hex}", "xch": "0.0", "mojo": 0, "coins_count": 0})
        
    res = (await client.post(f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes", 
        json={"puzzle_hashes": list(ph_map.keys()), "include_spent_coins": True, "start_height": 0})).json()
    if not res.get("success"): raise HTTPException(status_code=400, detail=f"Node Err: {res.get('error')}")
    return {"records": res.get("coin_records", []), "ph_map": ph_map, "addresses": addrs}

@wallet_router.get("/dashboard")
async def get_wallet_dashboard(
    publicKeyHex: str = Query(...), mode: str = Query("light"), active_indexes: str = Query(None), limit: int = Query(200)
):
    try:
        cert, key = get_ssl_credentials()
        master_pk = G1Element.from_bytes(bytes.fromhex(publicKeyHex.replace("0x", "")))
        records, global_map, global_addrs, total_scanned = [], {}, [], 0
        
        print(f"\n--- 📥 ВХОДЯЩИЙ ЗАПРОС DASHBOARD | Режим: {mode.upper()} | Active Indexes: {active_indexes} ---")

        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as client:
            if mode == "heavy" or not active_indexes:
                cur_start, cur_end = 0, max(1, min(limit, MAX_LIM))
                while cur_start < MAX_LIM:
                    idxs = list(range(cur_start, min(cur_end, MAX_LIM)))
                    if not idxs: break
                    chunk = await scan_chunk(master_pk, idxs, client)
                    records.extend(chunk["records"])
                    global_map.update(chunk["ph_map"])
                    global_addrs.extend(chunk["addresses"])
                    total_scanned += len(idxs)
                    
                    max_act = max([chunk["ph_map"][r["coin"]["puzzle_hash"].replace("0x", "")]["index"] 
                                   for r in chunk["records"] if r["coin"]["puzzle_hash"].replace("0x", "") in chunk["ph_map"]], default=-1)
                    
                    if max_act != -1 and (cur_end - max_act) < GAP:
                        new_end = min(max_act + GAP + 1, MAX_LIM)
                        print(f"⚠️ [GAP TRIGGERED] Последняя монета на индексе {max_act}. До края чанка ({cur_end}) меньше {GAP} пустых мест.")
                        print(f"🔄 [AUTO-EXPANSION] Расширяем рамки сканирования. Следующий шаг: от {cur_end} до {new_end}")
                        cur_start, cur_end = cur_end, new_end
                    else: 
                        if max_act != -1:
                            print(f"✅ [GAP SAFE] Последняя монета на индексе {max_act}. Свободная зона до края чанка ({cur_end}) составляет {cur_end - max_act} адресов. Останавливаемся.")
                        else:
                            print(f"💤 [GAP CLEAN] В этом чанке вообще нет активности. Вышли в чистую пустыню. Выходим.")
                        break
            else:
                try: idxs = [int(i.strip()) for i in active_indexes.split(",") if i.strip().isdigit() and int(i) < MAX_LIM]
                except: idxs = []
                max_a = max(idxs, default=0)
                idxs = list(set([0, 1] + idxs + [i for i in [max_a + 1, max_a + 2] if i < MAX_LIM]))
                chunk = await scan_chunk(master_pk, idxs, client)
                records.extend(chunk["records"])
                global_map.update(chunk["ph_map"])
                global_addrs.extend(chunk["addresses"])
                total_scanned = len(idxs)

        total_mojo, tx_map, active_bal = 0, {}, {0}
        
        # Маппинг lookups строго привязан к хэшу puzzle_hash без 0x
        addr_lookups = {a["puzzle_hash"].replace("0x", ""): a for a in global_addrs}
        
        for r in records:
            c = r["coin"]
            amt, ph_clean, spent = c["amount"], c["puzzle_hash"].replace("0x", ""), r.get("spent", False)
            if ph_clean not in global_map: continue
            idx = global_map[ph_clean]["index"]
            
            if not spent:
                active_bal.add(idx)
                total_mojo += amt
                # 🎯 ФИКС: Убрали кривой inline синтаксис. Теперь всё пишется чисто и работает стабильно
                if ph_clean in addr_lookups:
                    addr_lookups[ph_clean]["mojo"] += amt
                    addr_lookups[ph_clean]["xch"] = str(addr_lookups[ph_clean]["mojo"] / 1e12)
                    addr_lookups[ph_clean]["coins_count"] += 1
            
            ts = r.get("timestamp", int(time.time()))
            
            tx_map[f"in_{c['parent_coin_info']}_{amt}"] = {
                "tx_id": c["parent_coin_info"][:16], 
                "parent_coin_info": c["parent_coin_info"], 
                "type": "incoming", 
                "amount": str(amt / 1e12), 
                "puzzle_hash": f"0x{ph_clean}", 
                "timestamp": ts
            }
            if spent: 
                tx_map[f"out_{c['parent_coin_info']}_{amt}"] = {
                    "tx_id": c["parent_coin_info"][:16], 
                    "parent_coin_info": c["parent_coin_info"], 
                    "type": "outgoing", 
                    "amount": str(amt / 1e12), 
                    "puzzle_hash": f"0x{ph_clean}", 
                    "timestamp": ts
                }
        txs = sorted(list(tx_map.values()), key=lambda x: x["timestamp"], reverse=True)
        print(f"🏁 [DASHBOARD SUCCESS] Всего опрошено адресов за этот вызов: {total_scanned} | Живых индексов с балансом: {sorted(list(active_bal))}\n")
        
        return {
            "meta": {"mode": mode, "scanned": total_scanned, "active_indexes": sorted(list(active_bal))},
            "balance": {"total_xch": str(total_mojo / 1e12), "total_mojo": str(total_mojo), "addresses": global_addrs if mode == "heavy" else [a for a in global_addrs if a["mojo"] > 0 or a["index"] == 0]},
            "transactions": txs[:50]
        }
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@wallet_router.get("/track-tx/{tx_id}/{coin_id}")
async def track_transaction_status(tx_id: str, coin_id: str):
    try:
        cert, key = get_ssl_credentials()
        c_tx, c_coin = f"0x{tx_id.replace('0x', '').strip()}", f"0x{coin_id.replace('0x', '').strip()}"
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as c:
            cr = (await c.post(f"{BASE_RPC_URL}/get_coin_record_by_name", json={"name": c_coin})).json()
            rec = cr.get("coin_record")
            if rec and rec.get("spent", False):
                return {"success": True, "status": "confirmed", "block_height": rec.get("spent_block_index"), "timestamp": rec.get("timestamp")}
            mp = (await c.post(f"{BASE_RPC_URL}/get_mempool_item_by_tx_id", json={"tx_id": c_tx})).json()
            if mp.get("success") and mp.get("mempool_item"):
                return {"success": True, "status": "pending", "fee": mp["mempool_item"].get("fee"), "npc_result": mp["mempool_item"].get("npc_result", {}).get("conds", {})}
            return {"success": False, "status": "not_found", "reason": "Kicked or never existed"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
