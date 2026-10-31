import os, requests, urllib3, hashlib
from pathlib import Path
from chia_rs import AugSchemeMPL, G1Element

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
BASE_RPC_URL = "https://localhost:8555"

def get_ssl_credentials():
    home = Path.home()
    for f in ["testnet11", "mainnet"]:
        c, k = home / f".chia/{f}/config/ssl/full_node/private_full_node.crt", home / f".chia/{f}/config/ssl/full_node/private_full_node.key"
        if c.exists() and k.exists(): return str(c), str(k)
    return "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.crt", "C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node\\private_full_node.key"

def get_wallet_pk_unhardened(master_pk: G1Element, index: int) -> G1Element:
    path = [12381, 8444, 2, index]
    current_pk = master_pk
    for element in path: current_pk = AugSchemeMPL.derive_child_pk_unhardened(current_pk, element)
    return current_pk

def fetch_balances_from_node(puzzle_hashes_dict):
    c_p, k_p = get_ssl_credentials()
    res = requests.post(f"{BASE_RPC_URL}/get_coin_records_by_puzzle_hashes", json={"puzzle_hashes": list(puzzle_hashes_dict.keys()), "include_spent_coins": False, "start_height": 0}, cert=(c_p, k_p), verify=False).json()
    if not res.get("success"): raise ValueError(res.get("error"))
    return res.get("coin_records", [])

def fetch_genesis(cert, key):
    res = requests.post(f"{BASE_RPC_URL}/get_block_record_by_height", json={"height": 0}, cert=(cert, key), verify=False).json()
    if not res.get("success"): raise ValueError(res.get("error"))
    return bytes.fromhex(res["block_record"]["prev_hash"].replace("0x", ""))
