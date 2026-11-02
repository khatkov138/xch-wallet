import os
import hmac
import httpx
from fastapi import APIRouter, Body, HTTPException
from dotenv import load_dotenv
from chia_rs import G2Element, SpendBundle, Coin, CoinSpend, Program, AugSchemeMPL

# Импортируем проверенные утилиты проверки целостности
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

        # 1. РЕКОНСТРУКЦИЯ СТРУКТУРЫ ДЛЯ ПРОВЕРКИ ЦЕЛОСТНОСТИ ДАННЫХ (HMAC)
        reconstructed_coin_spends = []
        
        for idx, cs in enumerate(coin_spends):
            # 🛡️ Абсолютный Zero-Knowledge: забираем переданные фронтом параметры,
            # которые он честно получил от Билдера на Шаге 1.
            sent_wallet_index = int(cs.get("wallet_index", 0))
            synthetic_offset_hex = str(cs.get("synthetic_offset_hex", ""))
            
            # Воссоздаем объект точь-в-точь, как он вышел из Билдера на Шаге 1
            reconstructed_coin_spends.append({
                "wallet_index": sent_wallet_index,
                "message_to_sign_hex": messages_signed_hex[idx],
                "synthetic_offset_hex": synthetic_offset_hex,
                "coin": {
                    "parent_coin_info": str(cs["coin"]["parent_coin_info"]),
                    "puzzle_hash": str(cs["coin"]["puzzle_hash"]),
                    "amount": int(cs["coin"]["amount"])
                },
                "puzzle_reveal": str(cs.get("puzzle_reveal", "")),
                "solution": str(cs.get("solution", ""))
            })

        # Мгновенный крипто-аудит: если хакер подменил хоть один индекс, адрес или сумму — HMAC развалится
        if not hmac.compare_digest(generate_multi_integrity_token(messages_signed_hex, reconstructed_coin_spends), integrity_token):
            print("❌ КРИТИЧЕСКИЙ СБОЙ HMAC: Обнаружена попытка изменения структуры транзакции!")
            raise HTTPException(status_code=403, detail="Критическая ошибка: Попытка подмены данных транзакции!")

        # 2. АГРЕГАЦИЯ ОРИГИНАЛЬНЫХ ПОДПИСЕЙ ФРОНТЕНДА (КАНОНИЧНЫЙ СТАНДАРТ BLS)
        try:
            cert, key = get_ssl_credentials()
            g2_elements = []
            
            for sig_hex in signatures_list:
                clean_sig = sig_hex.replace("0x", "").strip().lower()
                g2_elements.append(G2Element.from_bytes(bytes.fromhex(clean_sig)))
            
            # Склеиваем готовые подписи фронтенда в единую агрегированную сигнатуру Chia
            aggregated_signature_obj = AugSchemeMPL.aggregate(g2_elements)
            
            print("\n==============================================================")
            print("🔬 [СЕНДЕР КРИПТО-ИНСПЕКТОР] HMAC ПРОЙДЕН. ДАННЫЕ ЦЕЛИКОМ ЦЕЛИ СТРУКТУРЫ.")
            print(f"• Агрегировано сигнатур фронта: {len(g2_elements)}")
            print(f"• Общая подпись транзакции: {aggregated_signature_obj.to_bytes().hex()[:40]}...")
            print("==============================================================\n")
            
        except Exception as sig_err:
            print(f"❌ Ошибка агрегации подписей BLS: {str(sig_err)}")
            raise HTTPException(status_code=400, detail=f"Ошибка обработки подписей: {str(sig_err)}")

        # 3. ФОРМИРОВАНИЕ ФИНАЛЬНОГО SPENDBUNDLE ДЛЯ RPC-НОДЫ CHIA
        final_coin_spends = []
        for cs in coin_spends:
            c_obj = Coin(
                bytes.fromhex(str(cs["coin"]["parent_coin_info"]).replace("0x", "")),
                bytes.fromhex(str(cs["coin"]["puzzle_hash"]).replace("0x", "")),
                int(cs["coin"]["amount"])
            )
            from_reveal = bytes.fromhex(str(cs.get("puzzle_reveal", "")).replace("0x", ""))
            from_sol = bytes.fromhex(str(cs.get("solution", "")).replace("0x", ""))
            
            final_coin_spends.append(
                CoinSpend(c_obj, Program.from_bytes(from_reveal), Program.from_bytes(from_sol))
            )

        # Собираем каноничный бандл трат со склеенной подписью фронта
        spend_bundle = SpendBundle(final_coin_spends, aggregated_signature_obj)
        
        # 🚀 ОТПРАВЛЯЕМ В RPC НОДУ (Твой оригинальный SSL контракт на месте)
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as client:
            res = await client.post(f"{BASE_RPC_URL}/push_tx", json={"spend_bundle": spend_bundle.to_json_dict()})
            node_response = res.json()
            
        print("📥 [ОТВЕТ CHIA RPC NODE]:", node_response)
        return {"success": node_response.get("success", False), "node_reply": node_response}
            
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
