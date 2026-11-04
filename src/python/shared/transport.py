import requests
from shared.config import get_network_config

def fetch_balances_from_node(puzzle_hashes_dict: dict, network: str) -> list:
    # Динамически получаем URL и SSL-сертификаты для выбранной сети
    cfg = get_network_config(network)
    c_p, k_p = cfg["crt"], cfg["key"]
    rpc_url = cfg["rpc_url"]
    
    res = requests.post(
        f"{rpc_url}/get_coin_records_by_puzzle_hashes", 
        json={
            "puzzle_hashes": list(puzzle_hashes_dict.keys()), 
            "include_spent_coins": False, 
            "start_height": 0
        }, 
        cert=(c_p, k_p), 
        verify=False
    ).json()
    
    if not res.get("success"): 
        raise ValueError(res.get("error"))
    return res.get("coin_records", [])

def fetch_genesis(network: str) -> bytes:
    # Автоматически берем конфиг сети, ручные аргументы cert/key больше не нужны снаружи
    cfg = get_network_config(network)
    c_p, k_p = cfg["crt"], cfg["key"]
    rpc_url = cfg["rpc_url"]
    
    res = requests.post(
        f"{rpc_url}/get_block_record_by_height", 
        json={"height": 0}, 
        cert=(c_p, k_p), 
        verify=False
    ).json()
    
    if not res.get("success"): 
        raise ValueError(res.get("error"))
    return bytes.fromhex(res["block_record"]["prev_hash"].replace("0x", ""))
