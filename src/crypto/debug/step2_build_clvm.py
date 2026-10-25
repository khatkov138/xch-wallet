import logging
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from fastapi import HTTPException

# Импорты для работы с CLVM структурами Chia
from chia.types.blockchain_format.program import Program
from chia.types.blockchain_format.coin import Coin
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    puzzle_for_pk,
    solution_for_conditions,
    calculate_synthetic_public_key,
    DEFAULT_HIDDEN_PUZZLE_HASH
)
from chia_rs import G1Element
from chia.util.bech32m import decode_puzzle_hash

# ==========================================
# СХЕМЫ ДАННЫХ ДЛЯ ВАЛИДАЦИИ (Pydantic)
# ==========================================
class CoinInputSchema(BaseModel):
    parent_coin_info: str = Field(..., description="ID родительской монеты (Hex с 0x)")
    puzzle_hash: str = Field(..., description="Puzzle Hash монеты (Hex с 0x)")
    amount: int = Field(..., description="Сумма монеты в mojo")
    coin_id: str = Field(..., description="Уникальный Coin ID (Hex с 0x)")
    public_key: Optional[str] = Field(None, description="Опциональный PK для этой монеты")


class Step2Input(BaseModel):
    selected_coins: List[CoinInputSchema] = Field(..., description="Список монет, выбранных на Шаге 1")
    target_address_ph: str = Field(..., description="Puzzle Hash (Hex) или XCH/TXCH адрес получателя")
    change_address_ph: str = Field(..., description="Puzzle Hash (Hex) или XCH/TXCH адрес для возврата сдачи")
    amount: int = Field(..., description="Сумма отправки в mojo")
    fee: int = Field(..., description="Комиссия сети в mojo")
    public_key: str = Field(..., description="Общий публичный ключ отправителя для всех инпутов (Hex)")


def address_to_puzzle_hash(address_or_hex: str) -> bytes:
    cleaned = address_or_hex.strip()
    if cleaned.startswith(("xch", "txch")):
        try:
            return decode_puzzle_hash(cleaned)
        except Exception as e:
            raise ValueError(f"Невалидный формат Chia адреса '{cleaned}': {str(e)}")
    try:
        return bytes.fromhex(cleaned.replace("0x", ""))
    except Exception as e:
        raise ValueError(f"Строка '{cleaned}' не является валидным Hex-значением: {str(e)}")


# ==========================================
# ОСНОВНАЯ БИЗНЕС-ЛОГИКА ШАГА 2
# ==========================================
def run_step2(data: Step2Input) -> Dict[str, Any]:
    logging.info("--- [STEP 2] Сборка транзакции с генерацией AGG_SIG_ME ---")
    try:
        target_ph = address_to_puzzle_hash(data.target_address_ph)
        change_ph = address_to_puzzle_hash(data.change_address_ph)

        # Обработка публичного ключа и вычисление Synthetic PK по CHIP-0002
        try:
            clean_pk = data.public_key.replace("0x", "").strip()
            pk_g1 = G1Element.from_bytes(bytes.fromhex(clean_pk))
            
            # Получаем Synthetic Public Key для условий AGG_SIG_ME
            synthetic_pk = calculate_synthetic_public_key(pk_g1, DEFAULT_HIDDEN_PUZZLE_HASH)
            
            # Puzzle Reveal строится от оригинального публичного ключа
            puzzle = puzzle_for_pk(pk_g1)
            puzzle_reveal_hex = bytes(puzzle).hex()
        except Exception as e:
            raise ValueError(f"Ошибка обработки общего public_key или деривации: {str(e)}")

        total_input_amount = sum(c.amount for c in data.selected_coins)
        change_amount = total_input_amount - data.amount - data.fee

        if change_amount < 0:
            raise ValueError(
                f"Недостаточно mojo! Выбрано: {total_input_amount}, "
                f"требуется: {data.amount + data.fee}"
            )

        # Формируем список условий (Conditions) транзакции
        conditions = []
        conditions.append(Program.to([51, target_ph, data.amount])) # CREATE_COIN получателю
        
        if change_amount > 0:
            conditions.append(Program.to([51, change_ph, change_amount])) # CREATE_COIN сдача
            
        if data.fee > 0:
            conditions.append(Program.to([52, data.fee])) # RESERVE_FEE

        # ЯВНО ДОБАВЛЯЕМ КОНСЕНСУСНОЕ УСЛОВИЕ AGG_SIG_ME (Опкод 50)
        # В качестве сообщения (второй аргумент) передаем puzzle_hash монеты плательщика
        source_coin_ph = bytes.fromhex(data.selected_coins[0].puzzle_hash.replace("0x", "").strip())
        conditions.append(Program.to([50, bytes(synthetic_pk), source_coin_ph]))

        cond_program = Program.to(conditions)

        coin_spends_output = []
        
        for i, coin_data in enumerate(data.selected_coins):
            try:
                native_coin = Coin(
                    bytes.fromhex(coin_data.parent_coin_info.replace("0x", "").strip()),
                    bytes.fromhex(coin_data.puzzle_hash.replace("0x", "").strip()),
                    coin_data.amount
                )
                coin_id_hex = f"0x{native_coin.name().hex()}"
            except Exception as e:
                raise ValueError(f"Ошибка парсинга монеты на индексе {i}: {str(e)}")
            
            # Условия выполнения (Conditions) идут только в первый инпут траты
            if i == 0:
                solution = solution_for_conditions(cond_program)
            else:
                solution = solution_for_conditions(Program.to([]))

            solution_hex = bytes(solution).hex()

            coin_spends_output.append({
                "coin": {
                    "amount": native_coin.amount,
                    "parent_coin_info": f"0x{native_coin.parent_coin_info.hex()}",
                    "puzzle_hash": f"0x{native_coin.puzzle_hash.hex()}",
                    "coin_id": coin_id_hex
                },
                "puzzle_reveal": f"0x{puzzle_reveal_hex}",
                "solution": f"0x{solution_hex}"
            })

        # =====================================================================
        # ХАРДКОРНЫЙ ИНСПЕКТОР CLVM УСЛОВИЙ ДЛЯ ЛОГИРОВАНИЯ В ТЕРМИНАЛ СЕРВЕРА
        # =====================================================================
        try:
            p_reveal_inspect = Program.from_bytes(bytes.fromhex(puzzle_reveal_hex))
            p_sol_inspect = Program.from_bytes(bytes.fromhex(coin_spends_output[0]["solution"].replace("0x", "")))
            
            # Имитируем выполнение виртуальной машины Chia
            _, clvm_conditions = p_reveal_inspect.run_with_cost(max_cost=1100000000, args=p_sol_inspect)
            
            print("\n\033[93m📋 === [ИНСПЕКЦИЯ CLVM УСЛОВИЙ ШАГА 2] ===\033[0m")
            for cond in clvm_conditions.as_iter():
                cond_list = list(cond.as_iter())
                if not cond_list: continue
                opcode = cond_list[0].as_int()
                
                if opcode == 49:
                    print(f"  🔴 [Опкод 49] AGG_SIG_UNSAFE: PK={cond_list[1].as_atom().hex()[:10]}... Msg={cond_list[2].as_atom().hex()}")
                elif opcode == 50:
                    print(f"  \033[92m🟢 [Опкод 50] AGG_SIG_ME ТРЕБУЕТСЯ: PK={cond_list[1].as_atom().hex()[:10]}... Msg={cond_list[2].as_atom().hex()}\033[0m")
                elif opcode == 51:
                    print(f"  🔵 [Опкод 51] CREATE_COIN: PH={cond_list[1].as_atom().hex()[:10]}... Amount={cond_list[2].as_int()}")
                else:
                    print(f"  ⚪ [Опкод {opcode}]: {[bytes(x).hex() for x in cond_list[1:]]}")
            print("\033[93m===========================================\033[0m\n")
        except Exception as inspect_err:
            print(f"Ошибка инспектора CLVM: {inspect_err}")

        logging.info(" ✅ Структура coin_spends успешно сгенерирована бэкендом.")
        return {
            "status": "success",
            "coin_spends": coin_spends_output,
            "rpc_signature": "0x00"
        }

    except Exception as e:
        logging.error(f"Критическая ошибка на Шаге 2: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Ошибка Шага 2: {str(e)}")
