import os
import httpx
from fastapi import APIRouter, Body, HTTPException
from dotenv import load_dotenv
from chia_rs import G1Element, Coin, CoinSpend, Program
from chia.types.blockchain_format.program import Program as PyProgram
from chia.util.bech32m import decode_puzzle_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    puzzle_for_pk, 
    solution_for_conditions, 
    DEFAULT_HIDDEN_PUZZLE_HASH,
    calculate_synthetic_offset
)
from chia.wallet.puzzles.puzzle_utils import make_create_coin_condition
from shared import get_ssl_credentials, fetch_genesis, BASE_RPC_URL, generate_multi_integrity_token

load_dotenv()
tx_router = APIRouter(prefix="/api/v1/transactions", tags=["Transactions Build Engine"])

async def check_node_synced_internal(client: httpx.AsyncClient):
    try:
        res = await client.post(f"{BASE_RPC_URL}/get_blockchain_state", json={})
        state_data = res.json()
        if state_data.get("success") and not state_data.get("blockchain_state", {}).get("sync", {}).get("synced", False):
            raise HTTPException(status_code=503, detail="Полная нода Chia синхронизируется. Попробуйте позже.")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Служба блокчейна временно недоступна.")
        
@tx_router.post("/build-spend-bundle")
async def build_spend_bundle(
    inputs: list[dict] = Body(..., description="Массив объектов {coin_pk_hex, coin_to_spend, wallet_index}"),
    send_to_address: str = Body(..., embed=True),
    mojos_to_send: int = Body(..., embed=True),
    fee_mojos: int = Body(0, embed=True),
    # 🎯 ЖЕЛЕЗНЫЙ ФЛАГ SEND MAX: Сеттим по умолчанию в True, если хочешь сквозное вычитание комиссий из инпута
    subtract_fee_from_amount: bool = Body(True, embed=True)
):
    try:
        if not inputs:
            raise HTTPException(status_code=400, detail="Список монет пуст!")
            
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
            
            if "wallet_index" not in item or item["wallet_index"] is None:
                raise HTTPException(status_code=400, detail="Критическая ошибка: Фронтенд не передал wallet_index!")
            
            total_input_amount += amt
            py_puzzle = puzzle_for_pk(G1Element.from_bytes(bytes.fromhex(item["coin_pk_hex"].replace("0x", ""))))
            
            if p_hash.hex().lower() != py_puzzle.get_tree_hash().hex().lower():
                raise HTTPException(status_code=403, detail="Критическая ошибка: Пузл-хэш монеты не совпадает с ключом!")
                
            parsed_coins.append({
                "coin_obj": Coin(p_info, p_hash, amt), 
                "py_puzzle": py_puzzle, 
                "coin_pk_hex": item["coin_pk_hex"], 
                "wallet_index": int(item["wallet_index"])
            })
        PROJECT_DUST_ADDRESS = "txch12dza3pwr4gzyfxgvl04tlu67nlhw5yv86sx3snkqr0tck2ss4uns4fqh9w"
        DUST_FEE_MOJOS = 100_000_000  # 0.0001 XCH Комиссия билдера

        # 🎯 ЖЕСТКИЙ ФИКС МАТЕМАТИКИ: Пересчитываем mojos_to_send ДО формирования условий траты
        if subtract_fee_from_amount:
            mojos_to_send = mojos_to_send - fee_mojos - DUST_FEE_MOJOS
            if mojos_to_send <= 0:
                raise HTTPException(status_code=400, detail="Сумма перевода слишком мала для покрытия комиссий!")
            required = mojos_to_send + fee_mojos + DUST_FEE_MOJOS
        else:
            required = mojos_to_send + fee_mojos

        if total_input_amount < required:
            raise HTTPException(status_code=400, detail="Недостаточно выбранных монет на балансе!")
            
        lead_puzzle = parsed_coins[0]["py_puzzle"]
        lead_coin = parsed_coins[0]["coin_obj"]
        
        # 1. Основное условие: Отправка (сумма mojos_to_send УЖЕ скорректирована внутри лимита)
        lead_conds = [make_create_coin_condition(decode_puzzle_hash(send_to_address), mojos_to_send, [])]
        
        change_amount = total_input_amount - required
        fee_collected = DUST_FEE_MOJOS

        # 2. 🔌 ЖЕЛЕЗНАЯ ПРИСОСКА КОМИССИИ КОШЕЛЬКА
        lead_conds.append(make_create_coin_condition(decode_puzzle_hash(PROJECT_DUST_ADDRESS), DUST_FEE_MOJOS, []))

        # 3. Возврат остатка сдачи пользователю на ведущий адрес
        if change_amount > 0:
            lead_conds.append(make_create_coin_condition(lead_puzzle.get_tree_hash(), change_amount, []))
            
        # 4. Сбор доноров через анонсы
        if len(parsed_coins) > 1:
            for idx in range(1, len(parsed_coins)):
                donor_coin = parsed_coins[idx]["coin_obj"]
                lead_conds.append(PyProgram.to([62, donor_coin.name()]))

        coin_spends_json_list = []
        messages_to_sign = []
        
        for idx, item in enumerate(parsed_coins):
            coin = item["coin_obj"]
            puzzle = item["py_puzzle"]
            current_wallet_index = item["wallet_index"]
            
            if idx == 0:
                current_conds = lead_conds
            else:
                import hashlib
                announcement_message = lead_coin.puzzle_hash + coin.name()
                announcement_hash = hashlib.sha256(announcement_message).digest()
                current_conds = [PyProgram.to([63, announcement_hash])]
            
            py_sol = solution_for_conditions(PyProgram.to(current_conds))
            coin_spend = CoinSpend(coin, Program.from_bytes(bytes(puzzle)), Program.from_bytes(bytes(py_sol)))
            
            msg_hex = (py_sol.rest().first().get_tree_hash() + coin.name() + genesis).hex()
            messages_to_sign.append(msg_hex)
            
            offset_int = calculate_synthetic_offset(
                G1Element.from_bytes(bytes.fromhex(item["coin_pk_hex"].replace("0x", ""))), 
                DEFAULT_HIDDEN_PUZZLE_HASH
            )
            synthetic_offset_hex = offset_int.to_bytes(32, byteorder="big").hex()

            coin_spends_json_list.append({
                "wallet_index": current_wallet_index, 
                "message_to_sign_hex": msg_hex,
                "synthetic_offset_hex": synthetic_offset_hex,
                "coin": {
                    "parent_coin_info": "0x" + coin.parent_coin_info.hex(), 
                    "puzzle_hash": "0x" + coin.puzzle_hash.hex(), 
                    "amount": coin.amount
                },
                "puzzle_reveal": "0x" + bytes(coin_spend.puzzle_reveal).hex(), 
                "solution": "0x" + bytes(coin_spend.solution).hex()
            })

        final_integrity_token = generate_multi_integrity_token(messages_to_sign, coin_spends_json_list)

        audit_info = {
            "summary": {
                "total_inputs_mojo": total_input_amount,
                "total_outputs_mojo": total_input_amount,
                "fee_network_mojo": fee_mojos,
                "is_dust_fee_collected": True,
                "is_dust_split_applied": False
            },
            "disposition": {
                "target": {
                    "address": send_to_address,
                    "puzzle_hash": "0x" + decode_puzzle_hash(send_to_address).hex(),
                    "amount_mojo": mojos_to_send  # Фронт увидит честную вычтенную блокчейн-сумму
                },
                "standard_change": {
                    "wallet_index": parsed_coins[0]["wallet_index"],
                    "puzzle_hash": "0x" + lead_puzzle.get_tree_hash().hex(),
                    "amount_mojo": change_amount
                },
                "dust_fee": {
                    "puzzle_hash": "0x" + decode_puzzle_hash(PROJECT_DUST_ADDRESS).hex(),
                    "amount_mojo": fee_collected
                }
            }
        }

        return {
            "success": True, 
            "integrity_token": final_integrity_token, 
            "coin_spends": coin_spends_json_list, 
            "verified_target_address": send_to_address, 
            "verified_mojos_to_send": mojos_to_send,
            "audit_info": audit_info
        }
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
