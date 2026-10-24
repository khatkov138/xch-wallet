import os
import ssl
import json
import urllib.request
import logging
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from chia.util.bech32m import decode_puzzle_hash

NETWORK = "testnet11"

class Step2Input(BaseModel):
    selected_coins: List[Dict[str, Any]]
    target_address_ph: str
    change_address_ph: str
    amount: int
    fee: int
    public_key: str
    wallet_sk_hex: Optional[str] = None

def call_wallet_rpc(method: str, data: dict) -> dict:
    url = f"https://localhost:9256/{method}"
    home_dir = os.environ.get("USERPROFILE") or os.environ.get("HOME") or os.path.expanduser("~") or "C:\\Users\\khatk"
    
    possible_dirs = [
        os.path.join(home_dir, ".chia", NETWORK, "config", "ssl", "wallet"),
        os.path.join(home_dir, ".chia", NETWORK, "config", "ssl", "full_node"),
        os.path.join(home_dir, ".chia", "mainnet", "config", "ssl", "wallet"),
        "C:\\Users\\khatk\\.chia\\testnet11\\config\\ssl\\wallet"
    ]
    
    cert_file, key_file = None, None
    for d in possible_dirs:
        c = os.path.join(d, "private_wallet.crt")
        k = os.path.join(d, "private_wallet.key")
        if os.path.exists(c):
            cert_file, key_file = c, k
            break
            
    if not cert_file:
        for d in possible_dirs:
            c = os.path.join(d, "private_full_node.crt")
            k = os.path.join(d, "private_full_node.key")
            if os.path.exists(c):
                cert_file, key_file = c, k
                break

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.load_cert_chain(certfile=cert_file, keyfile=key_file)
    
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, context=ctx) as response:
        return json.loads(response.read().decode('utf-8'))

def run_step2(data: Step2Input) -> Dict[str, Any]:
    logging.info("--- [STEP 2] Делегация сборки CLVM структур на нативный Wallet RPC ---")
    try:
        target_address = data.target_address_ph.strip()
        
        if not target_address.startswith(("xch", "txch")):
            from chia.util.bech32m import encode_puzzle_hash
            cleaned_ph = bytes.fromhex(target_address.replace("0x", ""))
            target_address = encode_puzzle_hash(cleaned_ph, "txch")

        rpc_res = call_wallet_rpc("send_transaction", {
            "wallet_id": 1,
            "amount": data.amount,
            "fee": data.fee,
            "address": target_address,
            "push_tx": False
        })
        
        if not rpc_res.get("success"):
            raise RuntimeError(f"Wallet RPC вернул ошибку: {rpc_res.get('error')}")
            
        sb = rpc_res["transaction"]["spend_bundle"]
        coin_spends = sb["coin_spends"]
        sig = sb["aggregated_signature"]
        
        logging.info(" ✅ Нативный кошелек успешно сгенерировал структуру и BLS подпись.")
        # Возвращаем подпись вместе с коин-спендами
        return {
            "status": "success", 
            "coin_spends": coin_spends, 
            "rpc_signature": sig if sig.startswith("0x") else f"0x{sig}"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка Шага 2 через RPC: {str(e)}")
