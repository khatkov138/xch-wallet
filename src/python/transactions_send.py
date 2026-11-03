import os
import time
import hmac
import httpx
from fastapi import APIRouter, Body, HTTPException
from dotenv import load_dotenv
from chia_rs import G2Element, SpendBundle, Coin, CoinSpend, Program, AugSchemeMPL

# Канонический импорт оригинального CLVM-раннера Chia
from chia.types.blockchain_format.program import Program as PyProgram

from chia.wallet.puzzles.puzzle_utils import make_create_coin_condition
from shared import get_ssl_credentials, BASE_RPC_URL, generate_multi_integrity_token

load_dotenv()
tx_router = APIRouter(prefix="/api/v1/transactions", tags=["Transactions Send Engine"])

@tx_router.post("/send-tx")
async def send_tx(
    signatures_list: list[str] = Body(..., embed=True),        
    coin_spends: list[dict] = Body(..., embed=True),            
    integrity_token: str = Body(..., embed=True), 
    messages_signed_hex: list[str] = Body(..., embed=True)       
):
    try:
        if not coin_spends:
            raise HTTPException(status_code=400, detail="Список монет пуст!")

        # 1. HMAC ВЕРИФИКАЦИЯ ЦЕЛОСТНОСТИ ДАННЫХ
        reconstructed_coin_spends = []
        for idx, cs in enumerate(coin_spends):
            reconstructed_coin_spends.append({
                "wallet_index": int(cs.get("wallet_index", 0)),
                "message_to_sign_hex": messages_signed_hex[idx],
                "synthetic_offset_hex": str(cs.get("synthetic_offset_hex", "")),
                "coin": {
                    "parent_coin_info": str(cs["coin"]["parent_coin_info"]),
                    "puzzle_hash": str(cs["coin"]["puzzle_hash"]),
                    "amount": int(cs["coin"]["amount"])
                },
                "puzzle_reveal": str(cs.get("puzzle_reveal", "")),
                "solution": str(cs.get("solution", ""))
            })

        if not hmac.compare_digest(generate_multi_integrity_token(messages_signed_hex, reconstructed_coin_spends), integrity_token):
            raise HTTPException(status_code=403, detail="Критическая ошибка: Попытка подмены данных!")

        # 2. АГРЕГАЦИЯ BLS ПОДПИСЕЙ
        try:
            cert, key = get_ssl_credentials()
            g2_elements = [G2Element.from_bytes(bytes.fromhex(s.replace("0x", "").strip().lower())) for s in signatures_list]
            aggregated_signature_obj = AugSchemeMPL.aggregate(g2_elements)
        except Exception as sig_err:
            raise HTTPException(status_code=400, detail=f"Ошибка подписей: {str(sig_err)}")

        # 3. СБОРКА SPENDBUNDLE И ДЕТЕРМИНИРОВАННЫЙ РАСЧЕТ COIN ID ЧЕРЕЗ PYPROGRAM
        final_coin_spends = []
        spent_coin_ids = []
        created_coins = []
        
        print("\n=================== 🕵️‍♂️ [CLVM КРИПТО-ИНСПЕКТОР: СТАРТ ПАРСИНГА] ===================")
        for idx, cs in enumerate(coin_spends):
            c_obj = Coin(
                bytes.fromhex(str(cs["coin"]["parent_coin_info"]).replace("0x", "")),
                bytes.fromhex(str(cs["coin"]["puzzle_hash"]).replace("0x", "")),
                int(cs["coin"]["amount"])
            )
            coin_id = "0x" + c_obj.name().hex()
            spent_coin_ids.append(coin_id)
            print(f"📦 Обработка инпута [{idx}]: Coin ID = {coin_id}, Amount = {c_obj.amount} mojos")
            
            from_reveal = bytes.fromhex(str(cs.get("puzzle_reveal", "")).replace("0x", ""))
            from_sol = bytes.fromhex(str(cs.get("solution", "")).replace("0x", ""))
            
            try:
                # Виртуальная машина CLVM на базе PyProgram
                puzzle_program = PyProgram.from_bytes(from_reveal)
                solution_program = PyProgram.from_bytes(from_sol)
                
                cost, conditions_program = puzzle_program.run_with_cost(11_000_000_000, solution_program)
                print(f"  ⚡ CLVM Run успешен. Затраченный Cost: {cost}")
                
                # Итерируемся по списку условий
                for cond in conditions_program.as_iter():
                    cond_list = list(cond.as_iter())
                    
                    if len(cond_list) >= 3:
                        cond_code = cond_list[0].as_int()
                        
                        if cond_code == 51:  # 51 = CREATE_COIN
                            p_hash_bytes = cond_list[1].as_atom()
                            amount_int = cond_list[2].as_int()
                            
                            # Нативный хэш sha256(parent + puzzle + amount)
                            new_coin = Coin(c_obj.name(), p_hash_bytes, amount_int)
                            new_coin_id = "0x" + new_coin.name().hex()
                            
                            print(f"      🔥 ОБНАРУЖЕН CREATE_COIN! Новый Coin ID: {new_coin_id}, Назначено: {amount_int} mojo")
                            
                            created_coins.append({
                                "coin_id": new_coin_id,
                                "parent_coin_info": "0x" + c_obj.name().hex(),
                                "puzzle_hash": "0x" + p_hash_bytes.hex(),
                                "amount": amount_int
                            })
            except Exception as clvm_err:
                print(f"  ⚠️ Критический сбой CLVM Runner на индексе [{idx}]: {str(clvm_err)}")

            # Для SpendBundle скармливаем типы chia_rs
            final_coin_spends.append(CoinSpend(c_obj, Program.from_bytes(from_reveal), Program.from_bytes(from_sol)))
        print("=================== 🕵️‍♂️ [CLVM КРИПТО-ИНСПЕКТОР: КОНЕЦ ПАРСИНГА] ===================\n")

        spend_bundle = SpendBundle(final_coin_spends, aggregated_signature_obj)
        tx_id_hex = "0x" + spend_bundle.name().hex()
        
        # 4. PUSH В RPC НОДУ CHIA
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as client:
            res = await client.post(f"{BASE_RPC_URL}/push_tx", json={"spend_bundle": spend_bundle.to_json_dict()})
            node_response = res.json()
            
        is_success = node_response.get("success", False)
        
        return {
            "success": is_success,
            "tx_id": tx_id_hex,
            "status": node_response.get("status", "SUCCESS") if is_success else "FAILED",
            "timestamp": int(time.time()),
            "tracked_info": {
                "spent_coins": spent_coin_ids,
                "created_coins": created_coins
            },
            "node_reply": node_response
        }
            
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
