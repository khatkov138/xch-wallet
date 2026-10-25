import uvicorn, os, ssl, json, urllib.request, traceback
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Используем только нативные и стабильные структуры ядра chia_rs
from chia_rs import PrivateKey, G1Element, SpendBundle, CoinSpend, Coin, AugSchemeMPL
from chia_rs.sized_ints import uint64

from chia.types.blockchain_format.program import Program
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    puzzle_for_pk,
    calculate_synthetic_secret_key,
    DEFAULT_HIDDEN_PUZZLE_HASH
)
from chia.util.bech32m import decode_puzzle_hash

class TxReq(BaseModel):
    amount: int
    fee: int

def load_ssl() -> ssl.SSLContext:
    home = os.path.expanduser("~")
    s_dir = os.path.join(home, ".chia", "testnet11", "config", "ssl", "full_node")
    c_f, k_f = os.path.join(s_dir, "private_full_node.crt"), os.path.join(s_dir, "private_full_node.key")
    if not os.path.exists(c_f):
        s_dir = os.path.join(home, ".chia", "mainnet", "config", "ssl", "full_node")
        c_f, k_f = os.path.join(s_dir, "private_full_node.crt"), os.path.join(s_dir, "private_full_node.key")
    ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.load_cert_chain(certfile=c_f, keyfile=k_f)
    return ctx

def node_rpc(endpoint: str, payload: dict) -> dict:
    url = f"https://localhost:8555{endpoint}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, context=load_ssl()) as r:
        return json.loads(r.read().decode('utf-8'))

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.post("/send-transaction")
async def send_tx(req: TxReq):
    try:
        print("\n" + "="*80)
        print("🚀 ВХОДЯЩИЙ ЗАПРОС НА ОТПРАВКУ ТРАНЗАКЦИИ")
        print(f"   Сумма: {req.amount} mojo | Комиссия: {req.fee} mojo")
        print("="*80)

        # --- ЭТАЛОННЫЕ ДАННЫЕ СЕТИ И КОШЕЛЬКА ---
        # Используем First wallet secret key напрямую, чтобы избежать ошибок деривации
        WALLET_SK_HEX = "6a64b3668f5fae721ddd7aa3af5a1019db03cc42f5616d43171b63af9f0ab6bc"
        PK_HEX = "841381d21882bcaf61be2f57c05197f9c7997a9c90acc5f7a6d43cfcedd79cd581ded1f0e9e2c02d62339f47c7d66e04"
        GENESIS_CHALLENGE_BYTES = bytes.fromhex("37a90eb511475826af2786a356e9c40c83fead448be5484da622119eb8bb0c0e")
        
        # Твой текстовый адрес кошелька
        MY_TARGET_ADDRESS = "txch12dza3pwr4gzyfxgvl04tlu67nlhw5yv86sx3snkqr0tck2ss4uns4fqh9w"
        PH_BYTES = decode_puzzle_hash(MY_TARGET_ADDRESS)
        
        tot = req.amount + req.fee

        # Загружаем секретный ключ кошелька напрямую
        wallet_sk = PrivateKey.from_bytes(bytes.fromhex(WALLET_SK_HEX))
        
        # Синтетическая пара для подписи условий консенсуса
        synthetic_sk = calculate_synthetic_secret_key(wallet_sk, DEFAULT_HIDDEN_PUZZLE_HASH)
        synthetic_pk = synthetic_sk.get_g1()
        
        # Оригинальный Unhardened PK для сборки базового CLVM пазла
        unhardened_wallet_pk = G1Element.from_bytes(bytes.fromhex(PK_HEX))
        
        # Генерация базового смарт-контракта стандартного кошелька
        wallet_puzzle = puzzle_for_pk(unhardened_wallet_pk)
        puzzle_reveal_bytes = bytes(wallet_puzzle)
        
        calculated_ph = wallet_puzzle.get_tree_hash()
        assert calculated_ph == PH_BYTES, f"Критическая ошибка! Пазл-хэш не совпадает"
        print(f"   [+] Пазл-хэш ИДЕАЛЬНО совпал: {calculated_ph.hex()}")

        # --- ШАГ 1: ПОЛУЧЕНИЕ МОНЕТ С НОДЫ ---
        print("\n🔍 ШАГ 1: ПОЛУЧЕНИЕ МОНЕТ С НОДЫ...")
        res = node_rpc("/get_coin_records_by_puzzle_hash", {"puzzle_hash": f"0x{PH_BYTES.hex()}", "include_spent_coins": False})
        
        coins_found = []
        for cr in res.get("coin_records", []):
            if cr.get("spent"): continue
            c = cr["coin"]
            coins_found.append(Coin(
                bytes.fromhex(c["parent_coin_info"].replace("0x","")),
                bytes.fromhex(c["puzzle_hash"].replace("0x","")),
                uint64(c["amount"])
            ))
        
        coins_found.sort(key=lambda x: x.amount, reverse=True)
        
        sel = []
        acc = 0
        for coin in coins_found:
            sel.append(coin)
            acc += coin.amount
            if acc >= tot: break
            
        print(f"   Выбрано монет для траты: {len(sel)} на сумму {acc} mojo")
        if acc < tot: raise ValueError(f"Недостаточно средств")

        # --- ШАГ 2 И 3: СБОРКА CLVM И ГЕНЕРАЦИЯ ПОДПИСЕЙ ---
        print("\n📋 ПОБИТОВЫЙ ВЫВОД ДАННЫХ ДЛЯ КАЖДОЙ МОНЕТЫ:")
        signatures_list = []
        coin_spends = []
        
        for i, coin in enumerate(sel):
            # Условия (выход транзакции, сдача, комиссия) создаем ТОЛЬКО для первой монеты
            base_conditions = []
            if i == 0:
                base_conditions.append(Program.to([51, PH_BYTES, uint64(req.amount)]))
                if acc - tot > 0: 
                    base_conditions.append(Program.to([51, PH_BYTES, uint64(acc - tot)]))
                if req.fee > 0:
                    base_conditions.append(Program.to([60, uint64(req.fee)]))

            # Для AGG_SIG_ME в стандартных пазлах берется tree_hash от списка условий
            delegated_conditions_program = Program.to(base_conditions)
            delegated_message_hash = delegated_conditions_program.get_tree_hash()
            
            # Формируем полные условия с включением инструкции 50 (AGG_SIG_ME)
            final_conditions = [
                Program.to([50, bytes(synthetic_pk), delegated_message_hash])
            ] + base_conditions
            
            final_delegated_puzzle = Program.to((1, final_conditions))
            # Решение стандартного кошелька: (0 delegated_puzzle 0)
            solution_program = Program.to([0, final_delegated_puzzle, 0])

            coin_spend_bytes = (
                bytes(coin.parent_coin_info) +
                bytes(coin.puzzle_hash) +
                int(coin.amount).to_bytes(8, "big") +
                puzzle_reveal_bytes +
                bytes(solution_program)
            )
            coin_spends.append(CoinSpend.from_bytes(coin_spend_bytes))
            
            current_coin_id = coin.name()
            
            # 96-байтовое сообщение для консенсуса BLS (msg_hash + coin_id + genesis_challenge)
            msg_bytes = delegated_message_hash + current_coin_id + GENESIS_CHALLENGE_BYTES
            
            print(f"\n  [Монета #{i}]")
            print(f"    ► parent_id:  {coin.parent_coin_info.hex()}")
            print(f"    ► amount:     {coin.amount} mojo")
            print(f"    ► coin_id:    {current_coin_id.hex()}")
            print(f"    ► msg_hash:   {delegated_message_hash.hex()}")

            # Генерируем подпись текущей монеты синтетическим приватником кошелька
            coin_sig = AugSchemeMPL.sign(synthetic_sk, msg_bytes)
            signatures_list.append(coin_sig)

        # Перемножаем все подписи монет в единый агрегированный массив
        aggregated_signature = AugSchemeMPL.aggregate(signatures_list)
        print(f"\n   [+] Успешно сгенерирована и агрегирована подпись для {len(signatures_list)} монет")

        # --- ШАГ 4: СБОРКА И ОТПРАВКА SPEND BUNDLE ---
        print("\n📦 ШАГ 4: ОТПРАВКА ПАКЕТА НА FULL NODE RPC...")
        spend_bundle = SpendBundle(coin_spends, aggregated_signature)
        spend_bundle_json = spend_bundle.to_json_dict()
        
        res_push = node_rpc("/push_tx", {"spend_bundle": spend_bundle_json})
        print(f"   Ответ от Full Node: {json.dumps(res_push, indent=2)}")

        if res_push.get("success") is False:
            error_msg = res_push.get("error", "Unknown RPC error")
            raise HTTPException(status_code=400, detail=f"RPC Node Error: {error_msg}")

        return JSONResponse(content={"status": "success", "node_response": res_push})

    except Exception as e:
        print(f"\n❌ Критическая ошибка: {str(e)}")
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
