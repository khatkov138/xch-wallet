import os
import httpx
import time
from fastapi import APIRouter, HTTPException, Query
from chia_rs import G1Element
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk

# Импортируем утилиты из shared / config
from shared import get_wallet_pk_unhardened
from shared.config import get_network_config


wallet_router = APIRouter(prefix="/api/wallet", tags=["Wallets Engine"])
GAP, MAX_LIM = 40, 1000

async def scan_chunk(master_pk: G1Element, idxs: list[int], client: httpx.AsyncClient, rpc_url: str) -> dict:
    print(f"🚀 [RPC NODE REQUEST] Сканируем пачку индексов: от {min(idxs)} до {max(idxs)} (Всего: {len(idxs)} адресов)")
    
    ph_map, addrs = {}, []
    for i in idxs:
        wallet_pk = get_wallet_pk_unhardened(master_pk, i)
        ph = puzzle_for_pk(wallet_pk).get_tree_hash()
        ph_hex = ph.hex().lower()
        
        pubkey_hex_string = "0x" + bytes(wallet_pk).hex()
        ph_map[ph_hex] = {"index": i}
        
        addrs.append({
            "index": i, 
            "puzzle_hash": f"0x{ph_hex}", 
            "address_pubkey_hex": pubkey_hex_string, 
            "xch": "0.0", 
            "mojo": 0, 
            "coins_count": 0
        })
        
    try:
        response = await client.post(
            f"{rpc_url}/get_coin_records_by_puzzle_hashes", 
            json={"puzzle_hashes": list(ph_map.keys()), "include_spent_coins": True, "start_height": 0},
            timeout=30.0
        )
        res = response.json()
    except Exception as rpc_err:
        print(f"❌ [CRITICAL RPC ERROR] Не удалось связаться с нодой: {str(rpc_err)}")
        raise HTTPException(status_code=500, detail=f"RPC Connection Failed: {str(rpc_err)}")
        
    if not res.get("success"): 
        node_error = res.get('error') or "Unknown Chia RPC error (empty error field)"
        print(f"❌ [NODE ERROR REPORTED]: {node_error}")
        raise HTTPException(status_code=400, detail=f"Node Err: {node_error}")
        
    return {"records": res.get("coin_records", []), "ph_map": ph_map, "addresses": addrs}

@wallet_router.get("/dashboard")
async def get_wallet_dashboard(
    publicKeyHex: str = Query(...), 
    mode: str = Query("light"), 
    active_indexes: str = Query(None), 
    limit: int = Query(200),
    network: str = Query(..., pattern="^(mainnet|testnet11)$", description="Target network: mainnet or testnet11")

):
    try:
        # Извлекаем конфигурацию портов и сертификатов динамически через универсальный модуль конфигурации
        cfg = get_network_config(network)
        cert, key, rpc_url = cfg["crt"], cfg["key"], cfg["rpc_url"]
        
        master_pk = G1Element.from_bytes(bytes.fromhex(publicKeyHex.replace("0x", "")))
        records, global_map, global_addrs, total_scanned = [], {}, [], 0
        
        print(f"\n--- 📥 ВХОДЯЩИЙ ЗАПРОС DASHBOARD | Сеть: {network.upper()} | Режим: {mode.upper()} | Active Indexes: {active_indexes} ---")

        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as client:
            if mode == "heavy" or not active_indexes:
                cur_start, cur_end = 0, max(1, min(limit, MAX_LIM))
                while cur_start < MAX_LIM:
                    idxs = list(range(cur_start, min(cur_end, MAX_LIM)))
                    if not idxs: break
                    chunk = await scan_chunk(master_pk, idxs, client, rpc_url)
                    records.extend(chunk["records"])
                    global_map.update(chunk["ph_map"])
                    global_addrs.extend(chunk["addresses"])
                    total_scanned += len(idxs)
                    
                    max_act = max([chunk["ph_map"][r["coin"]["puzzle_hash"].replace("0x", "")]["index"] 
                                   for r in chunk["records"] if r["coin"]["puzzle_hash"].replace("0x", "") in chunk["ph_map"]], default=-1)
                    
                    if max_act != -1 and (cur_end - max_act) < GAP:
                        new_end = min(max_act + GAP + 1, MAX_LIM)
                        cur_start, cur_end = cur_end, new_end
                    else: 
                        break
            else:
                try: idxs = [int(i.strip()) for i in active_indexes.split(",") if i.strip().isdigit() and int(i) < MAX_LIM]
                except: idxs = []
                
                # Принудительный базовый пул 0-9 для мгновенного отслеживания UTXO в light режиме
                base_pool = list(range(0, 10))
                max_a = max(idxs, default=0)
                idxs = list(set(base_pool + idxs + [i for i in [max_a + 1, max_a + 2] if i < MAX_LIM]))
                
                chunk = await scan_chunk(master_pk, idxs, client, rpc_url)
                records.extend(chunk["records"])
                global_map.update(chunk["ph_map"])
                global_addrs.extend(chunk["addresses"])
                total_scanned = len(idxs)

        total_mojo, tx_map, active_bal = 0, {}, {0}
        unspent_coins_list = []
        
        addr_lookups = {a["puzzle_hash"].replace("0x", ""): a for a in global_addrs}
        
        for r in records:
            c = r["coin"]
            amt, ph_clean, spent = c["amount"], c["puzzle_hash"].replace("0x", ""), r.get("spent", False)
            if ph_clean not in global_map: continue
            idx = global_map[ph_clean]["index"]
            
            if not spent:
                active_bal.add(idx)
                total_mojo += amt
                
                if ph_clean in addr_lookups:
                    addr_lookups[ph_clean]["mojo"] += amt
                    addr_lookups[ph_clean]["xch"] = str(addr_lookups[ph_clean]["mojo"] / 1e12)
                    addr_lookups[ph_clean]["coins_count"] += 1
                
                unspent_coins_list.append({
                    "wallet_index": idx,
                    "coin": {
                        "parent_coin_info": c["parent_coin_info"],
                        "puzzle_hash": c["puzzle_hash"],
                        "amount": amt
                    }
                })
            
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
        
        # СОРТИРОВКА КОИНОВ: строго по возрастанию wallet_index, 
        # а внутри одного индекса — по убыванию баланса монеты (крупные UTXO первыми)
        sorted_unspent_coins = sorted(
            unspent_coins_list, 
            key=lambda x: (x["wallet_index"], -int(x["coin"]["amount"]))
        )
        
        print(f"🏁 [DASHBOARD SUCCESS] Сеть: {network.upper()} | Всего опрошено адресов: {total_scanned} | Живых индексов: {sorted(list(active_bal))}\n")
        
        return {
            "meta": {"network": network, "mode": mode, "scanned": total_scanned, "active_indexes": sorted(list(active_bal))},
            "balance": {
                "total_xch": str(total_mojo / 1e12), 
                "total_mojo": str(total_mojo), 
                "addresses": global_addrs if mode == "heavy" else [a for a in global_addrs if a["mojo"] > 0 or a["index"] < 10]
            },
            "unspent_coins": sorted_unspent_coins,
            "transactions": txs[:50]
        }
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
