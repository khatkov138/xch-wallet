import requests
from fastapi import APIRouter, Body, HTTPException
from chia_rs import G1Element, Coin, CoinSpend, Program
from chia.types.blockchain_format.program import Program as PyProgram
from chia.util.bech32m import decode_puzzle_hash, encode_puzzle_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk, solution_for_conditions, DEFAULT_HIDDEN_PUZZLE_HASH
from chia.wallet.puzzles.puzzle_utils import make_create_coin_condition
from shared import get_ssl_credentials, fetch_genesis, get_wallet_pk_unhardened, TESTNET_PREFIX, BASE_RPC_URL

tx_router = APIRouter(prefix="/api/v1/transactions", tags=["Transactions Engine"])

# --- МЕТОД #1: СБОРКА БАНДЛА И ОПРЕДЕЛЕНИЕ ИНДЕКСА МОНЕТЫ ---
@tx_router.post("/build-spend-bundle")
async def build_spend_bundle(
    master_pk_hex: str = Body(..., embed=True),
    send_to_address: str = Body(..., embed=True),
    mojos_to_send: int = Body(..., embed=True),
    fee_mojos: int = Body(0, embed=True)
):
    try:
        print("\n=== PYTHON: START BUILD BUNDLE ===", flush=True)
        print(f"[PY] master_pk_hex input: {master_pk_hex}", flush=True)
        
        required = mojos_to_send + fee_mojos
        cert, key = get_ssl_credentials()
        genesis = fetch_genesis(cert, key)
        master_pk = G1Element.from_bytes(bytes.fromhex(master_pk_hex.replace("0x", "")))
        puzzle_hashes_map = {}
        
        # Генерация дерева пулл-хэшей для поиска монет до 200 индексов
        for idx in range(200):
            wallet_pk = get_wallet_pk_unhardened(master_pk, idx)
            ph = puzzle_for_pk(wallet_pk).get_tree_hash()
            puzzle_hashes_map[ph.hex()] = (idx, encode_puzzle_hash(ph, TESTNET_PREFIX), wallet_pk)
            
            if idx < 5:
                print(f"[PY_GEN_INDEX {idx}] -> wallet_pk: {bytes(wallet_pk).hex()} | puzzle_hash: 0x{ph.hex()}", flush=True)
            
        print(f"[PY] Отправка запроса в ноду для {len(puzzle_hashes_map)} хэшей...", flush=True)
        res = requests.post(
            f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes", 
            json={"puzzle_hashes": list(puzzle_hashes_map.keys()), "include_spent_coins": False, "start_height": 0}, 
            cert=(cert, key), 
            verify=False
        ).json()
        
        coin_records = res.get("coin_records", [])
        print(f"[PY] Нода вернула {len(coin_records)} незакрытых монет.", flush=True)
        
        best_coin, best_amt, best_idx = None, -1, -1
        
        for r in coin_records:
            c_data = r["coin"]
            amt, ph_clean = c_data["amount"], c_data["puzzle_hash"].replace("0x", "")
            
            print(f"[PY_COIN_FOUND] Coin on PH: 0x{ph_clean} | Amount: {amt}", flush=True)
            
            if amt >= required and amt > best_amt:
                best_amt = amt
                best_idx, _, wallet_pk = puzzle_hashes_map[ph_clean]
                best_coin = Coin(bytes.fromhex(c_data["parent_coin_info"].replace("0x", "")), bytes.fromhex(ph_clean), amt)
                    
        if not best_coin: 
            print("[PY_ERROR] Подходящих монет в ответе ноды не найдено!", flush=True)
            raise HTTPException(status_code=400, detail="Нет монет для покрытия суммы + комиссии!")
        
        print(f"[PY_SUCCESS] Выбрана монета! Индекс: {best_idx} | Сумма: {best_amt}", flush=True)
        _, _, wallet_pk = puzzle_hashes_map[best_coin.puzzle_hash.hex()]
        py_puzzle = puzzle_for_pk(wallet_pk)
        change = best_coin.amount - required
        
        conds = [make_create_coin_condition(decode_puzzle_hash(send_to_address), mojos_to_send, [])]
        if change > 0: 
            conds.append(make_create_coin_condition(py_puzzle.get_tree_hash(), change, []))
            
        py_sol = solution_for_conditions(PyProgram.to(conds))
        coin_spend = CoinSpend(best_coin, Program.from_bytes(bytes(py_puzzle)), Program.from_bytes(bytes(py_sol)))
        
        # Формирование хэша сообщения под условия траты согласно консенсусу Chia
        msg = py_sol.rest().first().get_tree_hash() + best_coin.name() + genesis
        
               # На бэкенде, в самом конце метода /build-spend-bundle:
        return {
            "success": True,
            "target_wallet_index": best_idx,
            "message_to_sign_hex": msg.hex(),
            "hidden_puzzle_hash_hex": DEFAULT_HIDDEN_PUZZLE_HASH.hex(),  # 🔥 ОТДАЕМ ОРИГИНАЛЬНЫЙ ХЭШ С СЕРВЕРА
            "coin_spend": {
                "coin": {
                    "parent_coin_info": "0x" + coin_spend.coin.parent_coin_info.hex(), 
                    "puzzle_hash": "0x" + coin_spend.coin.puzzle_hash.hex(), 
                    "amount": coin_spend.coin.amount
                },
                "puzzle_reveal": "0x" + bytes(coin_spend.puzzle_reveal).hex(),
                "solution": "0x" + bytes(coin_spend.solution).hex()
            }
        }

    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# --- МЕТОД #2: ПРИЕМ ГОТОВОЙ СИГНАТУРЫ И МГНОВЕННЫЙ ПУШ В СЕТЬ ---
# --- МЕТОД #2: ПРИЕМ ГОТОВОЙ СИГНАТУРЫ И МГНОВЕННЫЙ ПУШ В СЕТЬ ---
@tx_router.post("/send-tx")
async def send_tx(
    signature_hex: str = Body(..., embed=True),
    coin_spend: dict = Body(..., embed=True)
):
    try:
        cert, key = get_ssl_credentials()
        clean_sig = signature_hex.replace("0x", "")
        
        # 🛡️ СВЕРХНАДЁЖНЫЙ ПАРСИНГ: Извлекаем монету вне зависимости от того,
        # завернул её фронтенд в поле "coin" или прислал плоским объектом.
        if "coin" in coin_spend:
            coin_source = coin_spend["coin"]
        else:
            coin_source = coin_spend

        # Вытаскиваем Hex-строки и очищаем их от мусора
        p_coin_info = str(coin_source.get("parent_coin_info", "")).replace("0x", "").strip()
        p_hash = str(coin_source.get("puzzle_hash", "")).replace("0x", "").strip()
        amt = int(coin_source.get("amount", 0))
        
        p_reveal = str(coin_spend.get("puzzle_reveal", "")).replace("0x", "").strip()
        sol = str(coin_spend.get("solution", "")).replace("0x", "").strip()

        # 🚨 ЖЕСТКИЙ ПРЕДОХРАНИТЕЛЬ: Проверяем длину строк до отправки в ноду,
        # чтобы в консоли Python сразу было видно, если фронт прислал пустоту.
        if len(p_coin_info) != 64 or len(p_hash) != 64:
            raise HTTPException(
                status_code=400, 
                detail=f"Критическая ошибка сериализации: неверная длина Hex! "
                       f"parent_coin_info={len(p_coin_info)} симв., puzzle_hash={len(p_hash)} симв. "
                       f"Ожидалось строго 64 символа."
            )

        # Сборка финального SpendBundle для RPC-ноды Chia
        sb_json = {
            "coin_spends": [{
                "coin": {
                    "parent_coin_info": "0x" + p_coin_info, 
                    "puzzle_hash": "0x" + p_hash, 
                    "amount": amt
                },
                "puzzle_reveal": "0x" + p_reveal,
                "solution": "0x" + sol
            }],
            "aggregated_signature": "0x" + clean_sig
        }

        print(f"[PY_RPC_SEND] Пушим spend_bundle в сеть Chia...", flush=True)
        push_res = requests.post(
            f"{BASE_RPC_URL}/push_tx", 
            json={"spend_bundle": sb_json}, 
            cert=(cert, key), 
            verify=False
        ).json()
        
        if not push_res.get("success"): 
            error_msg = push_res.get("error", "Unknown node error")
            raise HTTPException(status_code=400, detail=f"Нода отклонила транзакцию: {error_msg}")
            
        return {"success": True, "status": "tx_submitted", "push_response": push_res}
        
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))