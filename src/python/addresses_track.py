import httpx
from fastapi import APIRouter, HTTPException, Query, status
from shared.config import get_network_config
from chia.util.bech32m import decode_puzzle_hash
from chia_rs import Coin  # Нативный билдер для расчета coin_id

addresses_router = APIRouter(prefix="/api/v1/addresses", tags=["Address Direct Tracker"])

def clean_to_puzzle_hash(input_str: str) -> str:
    val = input_str.strip()
    if val.startswith("xch") or val.startswith("txch"):
        try:
            return decode_puzzle_hash(val).hex().lower()
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid address format: {input_str}")
    return val.replace("0x", "").lower()

@addresses_router.get("/track-address")
async def track_address(
    puzzle_hash: str = Query(..., alias="puzzleHash"),
    include_spent: bool = Query(True, alias="includeSpent"),
    network: str = Query(..., pattern="^(mainnet|testnet11)$", description="Target network: mainnet or testnet11")


):
    """
    Высокоточный атомарный трекер адресов Chia с автоматической конвертацией
    Bech32m-адресов в puzzle_hash и расчетом валидных Coin ID.
    """
    try:
        clean_ph = clean_to_puzzle_hash(puzzle_hash)
        if not clean_ph:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="puzzleHash cannot be empty!")
        
        # Динамически извлекаем конфигурацию портов и SSL на базе выбранной сети
        cfg = get_network_config(network)
        cert, key, rpc_url = cfg["crt"], cfg["key"], cfg["rpc_url"]

        async with httpx.AsyncClient(verify=False, cert=(cert, key), timeout=5.0) as client:
            rpc_res = await client.post(
                f"{rpc_url}/get_coin_records_by_puzzle_hash",
                json={"puzzle_hash": clean_ph, "include_spent_coins": include_spent}
            )
            
            if rpc_res.status_code == 200:
                rpc_data = rpc_res.json()
                if rpc_data.get("success"):
                    coin_records = rpc_data.get("coin_records", [])
                    
                    confirmed_balance = 0
                    formatted_records = []

                    for record in coin_records:
                        coin_data = record.get("coin", {})
                        amount = coin_data.get("amount", 0)
                        is_spent = record.get("spent", False)

                        if not is_spent:
                            confirmed_balance += amount

                        # 🎯 Расчет реального Coin ID (Name) через криптографические примитивы Chia
                        try:
                            parent_id_bytes = bytes.fromhex(coin_data.get("parent_coin_info", "").replace("0x", ""))
                            puzzle_hash_bytes = bytes.fromhex(coin_data.get("puzzle_hash", "").replace("0x", ""))
                            
                            native_coin = Coin(parent_id_bytes, puzzle_hash_bytes, amount)
                            calculated_coin_id = native_coin.name().hex().lower()
                        except Exception:
                            calculated_coin_id = record.get("coin_record", {}).get("name", "").replace("0x", "")

                        formatted_records.append({
                            "coin_id": f"0x{calculated_coin_id}" if calculated_coin_id else "",
                            "amount_mojo": amount,
                            "confirmed_block": record.get("confirmed_block_index", 0),
                            "spent_block": record.get("spent_block_index", 0),
                            "is_spent": is_spent,
                            "timestamp": record.get("timestamp", 0),
                            "parent_coin_info": coin_data.get("parent_coin_info", "")
                        })

                    formatted_records.sort(key=lambda x: x["timestamp"], reverse=True)

                    return {
                        "success": True,
                        "puzzle_hash": f"0x{clean_ph}",
                        "status": "CONFIRMED",
                        "confirmed_balance_mojo": confirmed_balance,
                        "total_coins_tracked": len(formatted_records),
                        "coin_records": formatted_records
                    }

            return {"success": False, "puzzle_hash": f"0x{clean_ph}", "status": "NOT_FOUND", "confirmed_balance_mojo": 0, "total_coins_tracked": 0, "coin_records": []}

    except httpx.HTTPError as he:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"RPC Error: {str(he)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal Error: {str(e)}")
