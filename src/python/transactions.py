import os, httpx, hmac, hashlib, json
from fastapi import APIRouter, Body, HTTPException
from dotenv import load_dotenv
from chia_rs import G1Element, Coin, CoinSpend, Program, SpendBundle, G2Element, AugSchemeMPL
from chia.types.blockchain_format.program import Program as PyProgram
from chia.util.bech32m import decode_puzzle_hash, encode_puzzle_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk, solution_for_conditions, DEFAULT_HIDDEN_PUZZLE_HASH
from chia.wallet.puzzles.puzzle_utils import make_create_coin_condition
from shared import get_ssl_credentials, fetch_genesis, BASE_RPC_URL

load_dotenv()

API_SECRET = os.getenv("API_SECRET", "DEFAULT_FALLBACK_KEY_DO_NOT_USE_IN_PROD").encode("utf-8")
tx_router = APIRouter(prefix="/api/v1/transactions", tags=["Transactions Engine"])

def generate_multi_integrity_token(messages_list: list[str], coin_spends_list: list[dict]) -> str:
    serialized = f"{json.dumps(messages_list)}:{json.dumps(coin_spends_list, sort_keys=True)}"
    return hmac.new(API_SECRET, serialized.encode("utf-8"), hashlib.sha256).hexdigest()


async def check_node_synced_internal(client: httpx.AsyncClient):
    """Внутренний чек синхронизации полной ноды Chia перед сборкой контракта"""
    try:
        res = await client.post(f"{BASE_RPC_URL}/get_blockchain_state", json={})
        state_data = res.json()
        if state_data.get("success"):
            synced = state_data.get("blockchain_state", {}).get("sync", {}).get("synced", False)
            if not synced:
                raise HTTPException(
                    status_code=503, 
                    detail="Сеть кошелька временно недоступна: полная нода Chia находится в процессе синхронизации. Попробуйте отправить позже."
                )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Служба блокчейна временно недоступна. Проверьте подключение к ноде.")
        
@tx_router.post("/build-spend-bundle")
async def build_spend_bundle(
    inputs: list[dict] = Body(..., description="Массив объектов {coin_pk_hex, coin_to_spend}"),
    send_to_address: str = Body(..., embed=True),
    mojos_to_send: int = Body(..., embed=True),
    fee_mojos: int = Body(0, embed=True)
):
    try:
        if not inputs or len(inputs) == 0:
            raise HTTPException(status_code=400, detail="Список монет для отправки пуст!")
            
        required = mojos_to_send + fee_mojos
        cert, key = get_ssl_credentials()
        
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as c:
            await check_node_synced_internal(c)
        
        genesis = fetch_genesis(cert, key)
        
        total_input_amount = 0
        parsed_coins = []
        
        for item in inputs:
            c_src = item["coin_to_spend"]
            p_info = bytes.fromhex(c_src["parent_coin_info"].replace("0x", ""))
            p_hash = bytes.fromhex(c_src["puzzle_hash"].replace("0x", ""))
            amt = int(c_src["amount"])
            
            total_input_amount += amt
            
            # Получаем публичный ключ
            wallet_pk = G1Element.from_bytes(bytes.fromhex(item["coin_pk_hex"].replace("0x", "")))
            
            # Фиксируем структуру Chialisp-дерева в стандартный вид p2 кошелька
            py_puzzle = puzzle_for_pk(wallet_pk)
            
            if p_hash.hex().lower() != py_puzzle.get_tree_hash().hex().lower():
                raise HTTPException(
                    status_code=403, 
                    detail=f"Критическая ошибка: Пузл-хэш монеты {p_hash.hex()[:10]}... не совпадает с ключом!"
                )
                
            parsed_coins.append({
                "coin_obj": Coin(p_info, p_hash, amt),
                "py_puzzle": py_puzzle
            })
            
        if total_input_amount < required:
            raise HTTPException(status_code=400, detail="Общей суммы выбранных монет недостаточно для перевода и комиссии!")
            
        # =====================================================================
        # 2. ФОРМИРОВАНИЕ УСЛОВИЙ ТРАНЗАКЦИИ (СВЯЗКА ЧЕРЕЗ АНОНСЫ)
        # =====================================================================
        lead_puzzle = parsed_coins[0]["py_puzzle"]
        lead_coin = parsed_coins[0]["coin_obj"]
        
        # Базовые условия для первой (главной) монеты: платеж получателю
        lead_conds = [make_create_coin_condition(decode_puzzle_hash(send_to_address), mojos_to_send, [])]
        
        # Сдачу шлем на пузл-хэш первой монеты
        change_amount = total_input_amount - required
        if change_amount > 0:
            lead_conds.append(make_create_coin_condition(lead_puzzle.get_tree_hash(), change_amount, []))
            
        # Первая монета объявляет анонс для каждой монеты-донора (Код 62 = CREATE_PUZZLE_ANNOUNCEMENT)
        # В качестве сообщения используем имя (ID) донора, чтобы анонс был уникальным
        if len(parsed_coins) > 1:
            for idx in range(1, len(parsed_coins)):
                donor_coin = parsed_coins[idx]["coin_obj"]
                lead_conds.append(PyProgram.to([62, donor_coin.name()]))

        # =====================================================================
        # 3. СБОРКА COIN_SPENDS И ГЕНЕРАЦИЯ ХЭШЕЙ СООБЩЕНИЙ
        # =====================================================================
        coin_spends_json_list = []
        messages_to_sign = []
        
        for idx, item in enumerate(parsed_coins):
            coin = item["coin_obj"]
            puzzle = item["py_puzzle"]
            
            if idx == 0:
                current_conds = lead_conds
            else:
                # Каждая монета-донор вместо создания дублирующих монет 
                # просто утверждает анонс от главной монеты (Код 63 = ASSERT_PUZZLE_ANNOUNCEMENT)
                # Хэш анонса = SHA256(puzzle_hash_первой_монеты + ID_текущей_монеты)
                import hashlib
                announcement_message = lead_coin.puzzle_hash + coin.name()
                announcement_hash = hashlib.sha256(announcement_message).digest()
                current_conds = [PyProgram.to([63, announcement_hash])]
            
            py_sol = solution_for_conditions(PyProgram.to(current_conds))
            coin_spend = CoinSpend(coin, Program.from_bytes(bytes(puzzle)), Program.from_bytes(bytes(py_sol)))
            
            # СТРОГО ТВОЙ ОРИГИНАЛЬНЫЙ КОД РАСЧЕТА ХЭША (НЕ ТРОНУТ)
            msg_hex = (py_sol.rest().first().get_tree_hash() + coin.name() + genesis).hex()
            messages_to_sign.append(msg_hex)
            
            coin_spends_json_list.append({
                "coin": {
                    "parent_coin_info": "0x" + coin.parent_coin_info.hex(), 
                    "puzzle_hash": "0x" + coin.puzzle_hash.hex(), 
                    "amount": coin.amount
                },
                "puzzle_reveal": "0x" + bytes(coin_spend.puzzle_reveal).hex(), 
                "solution": "0x" + bytes(coin_spend.solution).hex()
            })
            
        return {
            "success": True, 
            "messages_to_sign_hex": messages_to_sign, 
            "integrity_token": generate_multi_integrity_token(messages_to_sign, coin_spends_json_list), 
            "coin_spends": coin_spends_json_list, 
            "hidden_puzzle_hash_hex": DEFAULT_HIDZEN_PUZZLE_HASH.hex() if 'DEFAULT_HIDZEN_PUZZLE_HASH' in globals() else DEFAULT_HIDDEN_PUZZLE_HASH.hex(), 
            "verified_target_address": send_to_address, 
            "verified_mojos_to_send": mojos_to_send
        }
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))




@tx_router.post("/send-tx")
async def send_tx(
    signatures_list: list[str] = Body(..., embed=True),        
    coin_spends: list[dict] = Body(..., embed=True),            
    integrity_token: str = Body(..., embed=True), 
    messages_signed_hex: list[str] = Body(..., embed=True)       
):
    try:
        # 1. Мгновенная проверка целостности данных (защита от подмены)
        if not hmac.compare_digest(generate_multi_integrity_token(messages_signed_hex, coin_spends), integrity_token):
            raise HTTPException(status_code=403, detail="Критическая ошибка: Попытка подмены данных транзакции!")

        # 2. КРИПТО-МАГИЯ: Склеиваем (агрегируем) все подписи в одну финальную сигнатуру BLS12-381
        try:
            g2_elements = [G2Element.from_bytes(bytes.fromhex(sig.replace("0x", ""))) for sig in signatures_list]
            # 🎯 Нативный и быстрый метод агрегации в chia_rs:
            aggregated_signature_obj = AugSchemeMPL.aggregate(g2_elements)
            final_signature_hex = aggregated_signature_obj.to_bytes().hex()
        except Exception as sig_err:
            raise HTTPException(status_code=400, detail=f"Крипто-ошибка агрегации подписей: {str(sig_err)}")

        # 3. Формируем финальный SpendBundle для ноды
        sb_json = {
            "coin_spends": [
                {
                    "coin": {
                        "parent_coin_info": "0x" + str(cs["coin"]["parent_coin_info"]).replace("0x", ""),
                        "puzzle_hash": "0x" + str(cs["coin"]["puzzle_hash"]).replace("0x", ""),
                        "amount": int(cs["coin"]["amount"])
                    }, 
                    "puzzle_reveal": "0x" + str(cs.get("puzzle_reveal", "")).replace("0x", "").strip(), 
                    "solution": "0x" + str(cs.get("solution", "")).replace("0x", "").strip()
                } for cs in coin_spends
            ], 
            "aggregated_signature": "0x" + final_signature_hex
        }
        
        # 4. Считаем tx_id и делаем ВСЕГО ОДИН атомарный запрос к RPC Chia
        cert, key = get_ssl_credentials()
        tx_id_hex = "0x" + SpendBundle.from_json_dict(sb_json).name().hex()
        
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as c:
            push_res = (await c.post(f"{BASE_RPC_URL}/push_tx", json={"spend_bundle": sb_json})).json()
        
        # 5. Обработка ответа ноды
        if push_res.get("success"):
            return {
                "success": True, 
                "status": "tx_submitted", 
                "tx_id": tx_id_hex, 
                "push_response": push_res
            }

        node_error = push_res.get("error", "Unknown error")
        if "NO_TRANSACTIONS_WHILE_SYNCING" in node_error:
            raise HTTPException(
                status_code=503, 
                detail="Нода Chia сейчас синхронизируется с сетью и временно не принимает транзакции. Пожалуйста, подождите несколько минут и повторите отправку."
            )

        return {"success": False, "error": node_error}

    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))