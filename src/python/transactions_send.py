import os
import hmac
import httpx
from fastapi import APIRouter, Body, HTTPException
from dotenv import load_dotenv
from chia_rs import G2Element, SpendBundle, AugSchemeMPL, PrivateKey, G1Element, Coin, CoinSpend, Program

# Импортируем оригинальные методы Chia для эталонной деривации
from chia.wallet.derive_keys import master_sk_to_wallet_sk_unhardened
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    calculate_synthetic_secret_key,
    DEFAULT_HIDDEN_PUZZLE_HASH,
    calculate_synthetic_offset,
    puzzle_for_pk
)
from chia.util.keychain import mnemonic_to_seed

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
        # 1. СИНХРОНИЗАЦИЯ СТРУКТУРЫ ДЛЯ ПРОВЕРКИ ЦЕЛОСТНОСТИ (HMAC)
        reconstructed_coin_spends = []
        
        try:
            # Наша эталонная тестовая мнемоника для инициализации карты индексов HMAC
            TEST_MNEMONIC = "material harvest garage wish seed possible item solar zero pupil off saddle glass dial burden desk apology wrap ivory work need favorite tilt burden"
            seed = mnemonic_to_seed(TEST_MNEMONIC)
            master_sk = PrivateKey.from_seed(seed)
            
            db_ph_map = {}
            for i in range(500):
                child_sk = master_sk_to_wallet_sk_unhardened(master_sk, i)
                w_pk = child_sk.get_g1()
                ph_clean = puzzle_for_pk(w_pk).get_tree_hash().hex().lower()
                db_ph_map[ph_clean] = i
        except Exception as e:
            print(f"💥 Ошибка инициализации карты индексов для HMAC: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Ошибка инициализации карты индексов для HMAC: {str(e)}")

        for idx, cs in enumerate(coin_spends):
            coin_ph_clean = cs["coin"]["puzzle_hash"].replace("0x", "").lower()
            real_wallet_index = db_ph_map.get(coin_ph_clean)
            
            # 🛡️ ГАРАНТИЯ СОСТОЯТЕЛЬНОСТИ: Динамический до-расчет индексов до 2000 (один в один как на Шаге 1)
            if real_wallet_index is None:
                print(f"⚠️ [ИНСПЕКТОР СЕНДЕРА] На Шаге 2 запущен глубокий поиск для {coin_ph_clean[:16]}...")
                for deep_idx in range(500, 2000):
                    deep_sk = master_sk_to_wallet_sk_unhardened(master_sk, deep_idx)
                    deep_ph = puzzle_for_pk(deep_sk.get_g1()).get_tree_hash().hex().lower()
                    if deep_ph == coin_ph_clean:
                        real_wallet_index = deep_idx
                        db_ph_map[coin_ph_clean] = deep_idx
                        break
                
                if real_wallet_index is None:
                    raise HTTPException(status_code=422, detail=f"Шаг 2: Не удалось сопоставить puzzle_hash {coin_ph_clean}")

            # Реконструируем оффсет, чтобы токен целостности полностью сошелся с Шагом 1
            child_sk = master_sk_to_wallet_sk_unhardened(master_sk, real_wallet_index)
            offset_int = calculate_synthetic_offset(child_sk.get_g1(), DEFAULT_HIDDEN_PUZZLE_HASH)
            synthetic_offset_hex = offset_int.to_bytes(32, byteorder="big").hex()
            
            # Собираем точную копию объекта, который был сгенерирован на Шаге 1
            reconstructed_coin_spends.append({
                "wallet_index": real_wallet_index,
                "message_to_sign_hex": messages_signed_hex[idx],
                "synthetic_offset_hex": synthetic_offset_hex,  # Передаем оффсет в верификацию токена
                "coin": {
                    "parent_coin_info": str(cs["coin"]["parent_coin_info"]),
                    "puzzle_hash": str(cs["coin"]["puzzle_hash"]),
                    "amount": int(cs["coin"]["amount"])
                },
                "puzzle_reveal": str(cs.get("puzzle_reveal", "")),
                "solution": str(cs.get("solution", ""))
            })

        # Мгновенная проверка целостности на основе реконструированных данных
        if not hmac.compare_digest(generate_multi_integrity_token(messages_signed_hex, reconstructed_coin_spends), integrity_token):
            print("❌ КРИТИЧЕСКИЙ СБОЙ HMAC: Токены целостности не совпали!")
            raise HTTPException(status_code=403, detail="Критическая ошибка: Попытка подмены данных транзакции!")

        # 2. КРИПТО-МАГИЯ СВЕРКИ И ПЕРЕПОДПИСАНИЯ (РАСШИРЕННЫЙ ИНСПЕКТОР)
        try:
            cert, key = get_ssl_credentials()
            g2_elements = []
            
            print("\n==============================================================")
            print("🔬 [КРИПТО-ДЕБАГ] СВЕРКА ТВОЕГО ФРОНТА С ЭТАЛОНОМ PYTHON")
            print("==============================================================")
            
            for idx, cs in enumerate(coin_spends):
                coin_ph_clean = cs["coin"]["puzzle_hash"].replace("0x", "").lower()
                real_wallet_index = db_ph_map.get(coin_ph_clean, 0)
                
                child_sk = master_sk_to_wallet_sk_unhardened(master_sk, real_wallet_index)
                synthetic_sk = calculate_synthetic_secret_key(child_sk, DEFAULT_HIDDEN_PUZZLE_HASH)
                
                front_msg_hex = messages_signed_hex[idx].replace("0x", "")
                final_message_bytes = bytes.fromhex(front_msg_hex)
                
                # Подписываем на бэкенде оригинальной BLS-математикой для формирования финального пула
                backend_sig_obj = AugSchemeMPL.sign(synthetic_sk, final_message_bytes)
                g2_elements.append(backend_sig_obj)
                
                front_sig_hex = signatures_list[idx].replace("0x", "").lower()
                backend_sig_hex = backend_sig_obj.to_bytes().hex().lower()
                
                print(f"   • Публичный ключ бэка для idx {real_wallet_index}: {bytes(child_sk.get_g1()).hex()}")
                print(f"\n👉 МОНЕТА [{idx}] | Нашли реальный индекс: {real_wallet_index}")
                print(f"   • Message для подписи:     {front_msg_hex[:50]}...")
                print(f"   • Эталонный Synthetic PK:  {bytes(synthetic_sk.get_g1()).hex()[:50]}...")
                print(f"   • Подпись от ФРОНТЕНДА:    {front_sig_hex[:50]}...")
                print(f"   • Сигнатура от БЭКЕНДА:    {backend_sig_hex[:50]}...")
                
                if front_sig_hex == backend_sig_hex:
                    print("   ✅ РЕЗУЛЬТАТ СВЕРКИ: Подписи совпали!")
                else:
                    print("   ❌ РЕЗУЛЬТАТ SVERKI: ПОДПИСИ РАЗНЫЕ!")
                    zero_child_sk = master_sk_to_wallet_sk_unhardened(master_sk, 0)
                    zero_synthetic_sk = calculate_synthetic_secret_key(zero_child_sk, DEFAULT_HIDDEN_PUZZLE_HASH)
                    zero_sig_hex = AugSchemeMPL.sign(zero_synthetic_sk, final_message_bytes).to_bytes().hex()
                    
                    if front_sig_hex == zero_sig_hex:
                        print("   🚨 АНОМАЛИЯ РАСКРЫТА: Фронтенд на самом деле подписал эту монету КЛЮЧОМ ОТ 0-ГО ИНДЕКСА!")
                    else:
                        print("   🤷‍♂️ Фронт подписал каким-то третьим ключом, деривация уплыла во внутренний кэш JS.")
            
            aggregated_signature_obj = AugSchemeMPL.aggregate(g2_elements)
            final_signature_hex = aggregated_signature_obj.to_bytes().hex()
            print(f"\n✅ Успешная агрегация сигнатур бэка: {final_signature_hex[:40]}...")
            print("==============================================================\n")
            
        except Exception as sig_err:
            print(f"❌ Критическая ошибка авто-подписания на бэке: {str(sig_err)}")
            raise HTTPException(status_code=400, detail=f"Ошибка переподписи на бэке: {str(sig_err)}")

        # 3. Формируем финальный SpendBundle для ноды
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

        # Собираем SpendBundle
        spend_bundle = SpendBundle(final_coin_spends, aggregated_signature_obj)
        
        # 🚀 ОТПРАВЛЯЕМ В RPC НОДУ
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as client:
            res = await client.post(f"{BASE_RPC_URL}/push_tx", json={"spend_bundle": spend_bundle.to_json_dict()})
            node_response = res.json()
            
        print("📥 [НОДА ОТВЕТ]:", node_response)
        return {"success": node_response.get("success", False), "node_reply": node_response}
            
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
