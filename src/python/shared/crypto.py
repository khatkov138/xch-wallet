import json
import hmac
import hashlib
from chia_rs import AugSchemeMPL, G1Element
from shared.config import API_SECRET

def generate_multi_integrity_token(messages_list: list[str], coin_spends_list: list[dict]) -> str:
    serialized = f"{json.dumps(messages_list)}:{json.dumps(coin_spends_list, sort_keys=True)}"
    return hmac.new(API_SECRET, serialized.encode("utf-8"), hashlib.sha256).hexdigest()

def get_wallet_pk_unhardened(master_pk: G1Element, index: int) -> G1Element:
    path = [12381, 8444, 2, index]
    current_pk = master_pk
    for element in path: 
        current_pk = AugSchemeMPL.derive_child_pk_unhardened(current_pk, element)
    return current_pk
