import os, httpx, hmac, hashlib, json
from fastapi import APIRouter, Body, HTTPException
from dotenv import load_dotenv
from chia_rs import G1Element, Coin, CoinSpend, Program, SpendBundle
from chia.types.blockchain_format.program import Program as PyProgram
from chia.util.bech32m import decode_puzzle_hash, encode_puzzle_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import puzzle_for_pk, solution_for_conditions, DEFAULT_HIDDEN_PUZZLE_HASH
from chia.wallet.puzzles.puzzle_utils import make_create_coin_condition
from shared import get_ssl_credentials, fetch_genesis, get_wallet_pk_unhardened, BASE_RPC_URL

load_dotenv()
IS_TESTNET = os.getenv("NEXT_PUBLIC_IS_TESTNET", "false").lower() == "true"
TESTNET_PREFIX = "txch" if IS_TESTNET else "xch"
API_SECRET = os.getenv("API_SECRET", "DEFAULT_FALLBACK_KEY_DO_NOT_USE_IN_PROD").encode("utf-8")
tx_router = APIRouter(prefix="/api/v1/transactions", tags=["Transactions Engine"])

def generate_integrity_token(msg_hex: str, coin_json: dict) -> str:
    serialized = f"{msg_hex.lower()}:{json.dumps(coin_json, sort_keys=True)}"
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
        # Если нода лежит или таймаут, мы всё равно не сможем отправить транзу, так что выдаем 503
        raise HTTPException(status_code=503, detail="Служба блокчейна временно недоступна. Проверьте подключение к ноде.")

@tx_router.post("/build-spend-bundle")
async def build_spend_bundle(
    master_pk_hex: str = Body(..., embed=True),
    wallet_index: int = Body(..., embed=True),   
    coin_to_spend: dict = Body(..., embed=True), 
    send_to_address: str = Body(..., embed=True),
    mojos_to_send: int = Body(..., embed=True),
    fee_mojos: int = Body(0, embed=True)
):
    try:
        required = mojos_to_send + fee_mojos
        cert, key = get_ssl_credentials()
        
        # 🎯 ШЛАГБАУМ НА ВХОДЕ: Идем проверять статус ноды по сети перед сборкой.
        # Если нода в процессе синхронизации — функция сразу выбросит HTTPException 503 и прервет билд.
        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as c:
            await check_node_synced_internal(c)
        
        genesis = fetch_genesis(cert, key)
        
        # 1. Распаковываем монету, присланную фронтендом
        c_parent = bytes.fromhex(coin_to_spend["parent_coin_info"].replace("0x", ""))
        c_ph_str = coin_to_spend["puzzle_hash"].replace("0x", "")
        c_amount = int(coin_to_spend["amount"])
        
        if c_amount < required:
            raise HTTPException(status_code=400, detail="Суммы выбранной монеты недостаточно для перевода и комиссии!")

        # 2. БЕЗОПАСНОСТЬ: Проверяем локально, что монета реально деривируется из этого master_pk по этому индексу
        master_pk = G1Element.from_bytes(bytes.fromhex(master_pk_hex.replace("0x", "")))
        wallet_pk = get_wallet_pk_unhardened(master_pk, wallet_index)
        py_puzzle = puzzle_for_pk(wallet_pk)
        expected_ph_hex = py_puzzle.get_tree_hash().hex()
        
        if c_ph_str.lower() != expected_ph_hex.lower():
            raise HTTPException(status_code=403, detail="Критическая ошибка: Пузл-хэш монеты не совпадает с ключом индекса!")

        # 3. Собираем объект Coin
        best_coin = Coin(c_parent, bytes.fromhex(c_ph_str), c_amount)
        
        # 4. Формируем условия Chia транзакции и расчет сдачи
        conds = [make_create_coin_condition(decode_puzzle_hash(send_to_address), mojos_to_send, [])]
        if best_coin.amount - required > 0: 
            conds.append(make_create_coin_condition(py_puzzle.get_tree_hash(), best_coin.amount - required, []))
            
        py_sol = solution_for_conditions(PyProgram.to(conds))
        coin_spend = CoinSpend(best_coin, Program.from_bytes(bytes(py_puzzle)), Program.from_bytes(bytes(py_sol)))
        msg_hex = (py_sol.rest().first().get_tree_hash() + best_coin.name() + genesis).hex()
        
        coin_spend_json = {
            "coin": {
                "parent_coin_info": "0x" + best_coin.parent_coin_info.hex(), 
                "puzzle_hash": "0x" + best_coin.puzzle_hash.hex(), 
                "amount": best_coin.amount
            },
            "puzzle_reveal": "0x" + bytes(coin_spend.puzzle_reveal).hex(), 
            "solution": "0x" + bytes(coin_spend.solution).hex()
        }
        
        return {
            "success": True, 
            "target_wallet_index": wallet_index, 
            "message_to_sign_hex": msg_hex, 
            "integrity_token": generate_integrity_token(msg_hex, coin_spend_json), 
            "coin_spend": coin_spend_json, 
            "hidden_puzzle_hash_hex": DEFAULT_HIDDEN_PUZZLE_HASH.hex(), 
            "verified_target_address": send_to_address, 
            "verified_mojos_to_send": mojos_to_send
        }
    except HTTPException as h: raise h
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@tx_router.post("/send-tx")
async def send_tx(signature_hex: str = Body(..., embed=True), coin_spend: dict = Body(..., embed=True), integrity_token: str = Body(..., embed=True), message_signed_hex: str = Body(..., embed=True)):
    try:
        if not hmac.compare_digest(generate_integrity_token(message_signed_hex, coin_spend), integrity_token):
            raise HTTPException(status_code=403, detail="Критическая ошибка: Попытка подмены данных транзакции!")

        cert, key = get_ssl_credentials()
        c_src = coin_spend.get("coin", coin_spend)
        p_info, p_hash, amt = str(c_src.get("parent_coin_info", "")).replace("0x", "").strip(), str(c_src.get("puzzle_hash", "")).replace("0x", "").strip(), int(c_src.get("amount", 0))
        
        if len(p_info) != 64 or len(p_hash) != 64: raise HTTPException(status_code=400, detail="Критическая ошибка serialization Hex!")
        coin_id_hex = "0x" + Coin(bytes.fromhex(p_info), bytes.fromhex(p_hash), amt).name().hex()

        async with httpx.AsyncClient(verify=False, cert=(cert, key)) as c:
            mp = (await c.post(f"{BASE_RPC_URL}/get_mempool_items_by_coin_name", json={"coin_name": coin_id_hex})).json()
            if mp.get("success") and len(mp.get("mempool_items", [])) > 0: raise HTTPException(status_code=400, detail="Транзакция уже находится в обработке ноды (в мемпуле)!")

            cr = (await c.post(f"{BASE_RPC_URL}/get_coin_record_by_name", json={"name": coin_id_hex})).json().get("coin_record")
            if not cr or cr.get("spent", True): raise HTTPException(status_code=400, detail="Ошибка: Эта монета не существует или уже была потрачена в блокчейне!")

            sb_json = {
                "coin_spends": [{
                    "coin": {"parent_coin_info": "0x" + p_info, "puzzle_hash": "0x" + p_hash, "amount": amt}, 
                    "puzzle_reveal": "0x" + str(coin_spend.get("puzzle_reveal", "")).replace("0x", "").strip(), 
                    "solution": "0x" + str(coin_spend.get("solution", "")).replace("0x", "").strip()
                }], 
                "aggregated_signature": "0x" + signature_hex.replace("0x", "").strip()
            }
            tx_id_hex = "0x" + SpendBundle.from_json_dict(sb_json).name().hex()
            push_res = (await c.post(f"{BASE_RPC_URL}/push_tx", json={"spend_bundle": sb_json})).json()
        
        if push_res.get("success"):
            return {
                "success": True, 
                "status": "tx_submitted", 
                "tx_id": tx_id_hex, 
                "coin_id": coin_id_hex, 
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
