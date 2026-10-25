import hashlib
from typing import List
from pydantic import BaseModel, Field
from blspy import AugSchemeMPL, PrivateKey


class CoinModel(BaseModel):
    parent_coin_info: str
    puzzle_hash: str
    amount: int
    coin_id: str


class CoinSpendModel(BaseModel):
    coin: CoinModel
    puzzle_reveal: str
    solution: str


class Step3Input(BaseModel):
    coin_spends: List[CoinSpendModel] = Field(..., alias="coin_spends")
    genesis_challenge: str = Field(..., alias="genesis_challenge")
    wallet_sk_hex: str = Field(..., alias="wallet_sk_hex")


class Step3Output(BaseModel):
    status: str
    aggregated_signature: str


def clean_hex(hex_str: str) -> bytes:
    if hex_str.startswith("0x") or hex_str.startswith("0X"):
        hex_str = hex_str[2:]
    return bytes.fromhex(hex_str)


def run_step3(input_data: Step3Input) -> Step3Output:
    # 1. Инициализируем оригинальный приватный ключ
    sk_bytes = clean_hex(input_data.wallet_sk_hex)
    unhardened_wallet_sk = PrivateKey.from_bytes(sk_bytes)
    
    # 2. Вычисляем Synthetic Secret Key на чистом blspy строго по спецификации CHIP-0002
    DEFAULT_HIDDEN_PUZZLE_HASH = bytes.fromhex("711d6c4e32c72e189c575b328d83491f4d7cf4bc498579bc5ab10b65882e3122")
    wallet_pk_bytes = bytes(unhardened_wallet_sk.get_g1())
    
    offset_bytes = hashlib.sha256(wallet_pk_bytes + DEFAULT_HIDDEN_PUZZLE_HASH).digest()
    
    order = 0x73eda753299d7d483339d80809a1d80553bdb406343d81e2dd6a0a04da2865b4
    int_wallet_sk = int.from_bytes(bytes(unhardened_wallet_sk), "big")
    int_offset_sk = int.from_bytes(offset_bytes, "big")
    int_synthetic_sk = (int_wallet_sk + int_offset_sk) % order
    
    synthetic_sk = PrivateKey.from_bytes(int_synthetic_sk.to_bytes(32, "big"))

    genesis_challenge_bytes = clean_hex(input_data.genesis_challenge)
    msgs: List[bytes] = []

    for spend in input_data.coin_spends:
        parent_bytes = clean_hex(spend.coin.parent_coin_info)
        puzzle_bytes = clean_hex(spend.coin.puzzle_hash)
        amount_bytes = spend.coin.amount.to_bytes(8, byteorder="big")

        # 3. Рассчитываем True Coin ID вручную по правилам консенсуса
        true_coin_id = hashlib.sha256(
            parent_bytes + puzzle_bytes + amount_bytes
        ).digest()

        # 4. Твой Шаг 2 зашивает в условие AGG_SIG_ME в качестве сообщения puzzle_hash плательщика
        message_bytes = puzzle_bytes

        # 5. Собираем финальный хэш сообщения по формуле AGG_SIG_ME
        msg_hash = hashlib.sha256(
            message_bytes + true_coin_id + genesis_challenge_bytes
        ).digest()

        msgs.append(msg_hash)

    # 6. Агрегируем подписи, созданные через вычисленный Synthetic SK
    sigs = [AugSchemeMPL.sign(synthetic_sk, msg) for msg in msgs]
    aggregated_signature = AugSchemeMPL.aggregate(sigs)

    return Step3Output(
        status="success",
        aggregated_signature="0x" + bytes(aggregated_signature).hex()
    )
