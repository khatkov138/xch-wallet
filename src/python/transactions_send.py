import os
import time
import hmac
import httpx
import traceback
from fastapi import APIRouter, HTTPException, status
from dotenv import load_dotenv
from pydantic import BaseModel, Field 

# Нативная криптография из Rust-биндингов Chia
from chia_rs import G2Element, SpendBundle, Coin, CoinSpend, Program, AugSchemeMPL

# CLVM-раннер для инспектирования дерева условий
from chia.types.blockchain_format.program import Program as PyProgram

from shared import generate_multi_integrity_token
from shared.config import get_network_config

load_dotenv()
tx_router = APIRouter(prefix="/api/v1/transactions", tags=["Transactions Send Engine"])

class SendTxRequest(BaseModel):
    network: str = Field(..., pattern="^(mainnet|testnet11)$", description="Target network: mainnet or testnet11")
    signatures_list: list[str] = Field(..., description="Список BLS подписей в формате hex")
    coin_spends: list[dict] = Field(..., description="Массив CoinSpend объектов Chia")
    integrity_token: str = Field(..., description="Токен целостности сессии транзакции")
    messages_signed_hex: list[str] = Field(..., description="Список хэшей подписанных сообщений")

@tx_router.post("/send-tx")
async def send_tx(payload: SendTxRequest):
    try:
        # Распаковка payload
        network = payload.network
        signatures_list = payload.signatures_list
        coin_spends = payload.coin_spends
        integrity_token = payload.integrity_token
        messages_signed_hex = payload.messages_signed_hex

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

        # Динамическая загрузка конфига сети (SSL-сертификаты и RPC URL)
        cfg = get_network_config(network)
        cert, key, rpc_url = cfg["crt"], cfg["key"], cfg["rpc_url"]

        # 2. АГРЕГАЦИЯ BLS ПОДПИСЕЙ В ОДИН G2ELEMENT С КАН ОНИЗАЦИЕЙ СТРОК
        try:
            g2_elements = [G2Element.from_bytes(bytes.fromhex(s.replace("0x", "").strip().lower())) for s in signatures_list]
            aggregated_signature_obj = AugSchemeMPL.aggregate(g2_elements)
        except Exception as sig_err:
            raise HTTPException(status_code=400, detail=f"Ошибка подписей: {str(sig_err)}")

        # 3. ДЕКЛАРАТИВНЫЙ СБОР ДАННЫХ ДЛЯ SPENDBUNDLE И FRONTEND-КЭША
        final_coin_spends = []
        raw_spent_coins_info = [] # 🎯 Сюда складываем монеты прямо из Payload (Входы)
        created_coins = []        # 🎯 Сюда складываем созданные монеты (Выходы)
        
        print("\n=================== 🕵️‍♂️ [CLVM КРИПТО-ИНСПЕКТОР: НАЧАЛО] ===================")
        for idx, cs in enumerate(coin_spends):
            # Десериализация оригинальной монеты, которую мы тратим
            c_obj = Coin(
                bytes.fromhex(str(cs["coin"]["parent_coin_info"]).replace("0x", "")),
                bytes.fromhex(str(cs["coin"]["puzzle_hash"]).replace("0x", "")),
                int(cs["coin"]["amount"])
            )
            
            # 🎯 ПРЯМОЙ СБОР ДАННЫХ ИНПУТА ДЛЯ UI ДАШБОРДА
            raw_spent_coins_info.append({
                "parent_coin_info": "0x" + c_obj.parent_coin_info.hex(),
                "puzzle_hash": "0x" + c_obj.puzzle_hash.hex(),
                "amount": int(c_obj.amount)
            })
            
            print(f"📦 Инпут [{idx}]: Parent = 0x{c_obj.parent_coin_info.hex()[:10]}..., Amount = {c_obj.amount} mojos")
            
            from_reveal = bytes.fromhex(str(cs.get("puzzle_reveal", "")).replace("0x", ""))
            from_sol = bytes.fromhex(str(cs.get("solution", "")).replace("0x", ""))
            
            try:
                # Виртуальная машина CLVM на базе PyProgram
                puzzle_program = PyProgram.from_bytes(from_reveal)
                solution_program = PyProgram.from_bytes(from_sol)
                
                # Запуск с ограничением по газу во избежание DoS
                cost, conditions_program = puzzle_program.run_with_cost(11_000_000_000, solution_program)
                print(f"  ⚡ CLVM Run успешен. Затраченный Cost: {cost}")
                
                for cond in conditions_program.as_iter():
                    cond_list = list(cond.as_iter())
                    
                    if len(cond_list) >= 3:
                        cond_code = cond_list[0].as_int()
                        
                        # 51 = CREATE_COIN
                        if cond_code == 51:  
                            p_hash_bytes = cond_list[1].as_atom()
                            amount_int = cond_list[2].as_int()
                            
                            # Вычисление канонического ID созданной дочерней монеты ноды
                            new_coin = Coin(c_obj.name(), p_hash_bytes, amount_int)
                            new_coin_id = "0x" + new_coin.name().hex()
                            
                            print(f"      🔥 ВЫХОД (CREATE_COIN): {new_coin_id}, Amount: {amount_int} mojo")
                            
                            created_coins.append({
                                "coin_id": new_coin_id,
                                "parent_coin_info": "0x" + c_obj.name().hex(),
                                "puzzle_hash": "0x" + p_hash_bytes.hex(),
                                "amount": amount_int
                            })
            except Exception as clvm_err:
                print(f"  ⚠️ Игнорируемый сбой CLVM Runner на индексе [{idx}]: {str(clvm_err)}")

            final_coin_spends.append(CoinSpend(c_obj, Program.from_bytes(from_reveal), Program.from_bytes(from_sol)))
        print("=================== 🕵️‍♂️ [CLVM КРИПТО-ИНСПЕКТОР: КОНЕЦ] ===================\n")

        # Компонуем SpendBundle
        spend_bundle = SpendBundle(final_coin_spends, aggregated_signature_obj)
        tx_id_hex = "0x" + spend_bundle.name().hex()
        
        # 4. PUSH В RPC НОДУ CHIA ЧЕРЕЗ SSL СЕРТИФИКАТЫ СЕТИ
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as client:
            res = await client.post(
                f"{rpc_url}/push_tx", 
                json={"spend_bundle": spend_bundle.to_json_dict()},
                timeout=30.0
            )
            node_response = res.json()
             
        is_success = node_response.get("success", False)
        node_status = node_response.get("status", "FAILED")
        
        return {
            "success": is_success,
            "tx_id": tx_id_hex,
            "status": node_status,
            "timestamp": int(time.time()),
            "tracked_info": {
                "spent_coins": raw_spent_coins_info, 
                "created_coins": created_coins
            },
            "node_reply": node_response
        }

    except HTTPException as h: 
        if not h.detail:
            h.detail = "Неизвестная HTTP ошибка при обработке транзакции"
        raise h
        
    except Exception as e: 
        error_message = str(e) if str(e).strip() else f"Системная ошибка типа: {e.__class__.__name__}"
        
        # Полный вывод трейса ошибки в консоль терминала бэкенда
        print(f"\n🚨 [КРИТИЧЕСКИЙ СБОЙ ДВИЖКА ТРАНЗАКЦИЙ]: {error_message}")
        traceback.print_exc()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Внутренний сбой движка транзакций: {error_message}"
        )
