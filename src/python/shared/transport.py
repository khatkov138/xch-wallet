import requests
from shared.config import BASE_RPC_URL, get_ssl_credentials

def fetch_balances_from_node(puzzle_hashes_dict: dict) -> list:
    c_p, k_p = get_ssl_credentials()
    res = requests.post(
        f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes", 
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

def fetch_genesis(cert: str, key: str) -> bytes:
    res = requests.post(
        f"{BASE_RPC_URL}/get_block_record_by_height", 
        json={"height": 0}, 
        cert=(cert, key), 
        verify=False
    ).json()
    
    if not res.get("success"): 
        raise ValueError(res.get("error"))
    return bytes.fromhex(res["block_record"]["prev_hash"].replace("0x", ""))
