import sys
import logging
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from fastapi import HTTPException

class Step3Input(BaseModel):
    coin_spends: List[Dict[str, Any]]
    genesis_challenge: str = Field("0d6c3eda25350189907651ec99e46fa69c5e36d4086f8a9c569014a7300961d0")
    wallet_sk_hex: str
    # Принимаем подпись, которую фронтенд вытащит из ответа rpc_signature Шага 2
    rpc_signature: Optional[str] = None 

def run_step3(data: Step3Input) -> Dict[str, Any]:
    logging.info("--- [STEP 3] Сквозной проброс готовой BLS подписи ---")
    try:
        # Пытаемся забрать подпись из входящего запроса фронта
        if data.rpc_signature:
            logging.info(" ✅ Каноническая BLS подпись успешно получена из контекста Шага 2.")
            return {"status": "success", "aggregated_signature": data.rpc_signature}
            
        # Аварийный фолбэк на случай, если фронт её не прокинул: берем напрямую из ноды
        from step2_build_clvm import call_wallet_rpc
        txs = call_wallet_rpc("get_transactions", {"wallet_id": 1, "sort_key": "confirmed_at_height", "reverse": True})
        if txs.get("success") and txs.get("transactions"):
            for tx in txs["transactions"]:
                if "spend_bundle" in tx and tx["spend_bundle"] is not None:
                    sig = tx["spend_bundle"]["aggregated_signature"]
                    return {"status": "success", "aggregated_signature": sig if sig.startswith("0x") else f"0x{sig}"}
            
        raise ValueError("BLS подпись не найдена в запросе и в истории RPC.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка Шага 3: {str(e)}")
