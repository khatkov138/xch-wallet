import os
import ssl
import json
import string
import logging
import urllib.request
from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Any, Optional

logger = logging.getLogger("CLVM_Debugger.Step4")

# ==========================================
# СХЕМЫ ВАЛИДАЦИИ ВХОДНЫХ ДАННЫХ (FASTAPI)
# ==========================================
class CoinStructure(BaseModel):
    parent_coin_info: str
    puzzle_hash: str
    amount: int

class SpendStructure(BaseModel):
    coin: CoinStructure
    puzzle_reveal: str
    solution: str
    coin_id: Optional[str] = None
    delegated_puzzle_tree_hash: Optional[str] = None

class Step4Input(BaseModel):
    coin_spends: List[SpendStructure] = Field(..., description="Массив расходов монет с Шагов 2/3")
    aggregated_signature: Optional[str] = Field(default=None, description="Агрегированная BLS подпись транзакции")
    node_url: str = Field("https://localhost:8555", description="URL адрес RPC полной ноды Chia")
    network: str = Field("testnet11", description="Идентификатор сети (testnet11 или mainnet)")
    cert_path: Optional[str] = Field(None, description="Кастомный путь к private_full_node.crt")
    key_path: Optional[str] = Field(None, description="Кастомный путь к private_full_node.key")

    @model_validator(mode="before")
    @classmethod
    def cascade_signature_scanner(cls, data: Any) -> Any:
        """
        Каскадный валидатор-сканер: рекурсивно ищет 192-символьный хекс подписи,
        даже если клиент передал 'signature' или 'sig' на верхнем или вложенных уровнях.
        """
        # Принудительное красивое логирование входящего JSON до валидации
        print("\n" + "═"*80)
        print("📥 [RAW DEBUG STEP 4] ВХОДЯЩИЙ СЛОВАРЬ (ДАННЫЕ ДО ВАЛИДАЦИИ PYDANTIC):")
        print("═"*80)
        print(json.dumps(data, indent=2, ensure_ascii=False) if isinstance(data, dict) else str(data))
        print("═"*80 + "\n")

        if not isinstance(data, dict):
            return data

        found_sig: Optional[str] = None

        def _recursive_search(node: Any):
            nonlocal found_sig
            if found_sig:
                return
            if isinstance(node, dict):
                # Проверяем все возможные алиасы ключа подписи
                for target_key in ["aggregated_signature", "signature", "sig", "aggregated_sig"]:
                    if target_key in node and isinstance(node[target_key], str):
                        cleaned = node[target_key].strip().lower()
                        if cleaned.startswith("0x"):
                            cleaned = cleaned[2:]
                        # Длина BLS подписи: 96 байт = 192 символа hex
                        if len(cleaned) == 192 and all(c in string.hexdigits for c in cleaned):
                            found_sig = node[target_key].strip()
                            return
                for value in node.values():
                    _recursive_search(value)
            elif isinstance(node, list):
                for item in node:
                    _recursive_search(item)

        _recursive_search(data)

        if found_sig:
            print(f"🎯 [DEBUG STEP 4] Автоматически найдена BLS подпись: {found_sig[:30]}...")
            data["aggregated_signature"] = found_sig
        else:
            print("⚠️ [DEBUG STEP 4] Внимание: Подходящая BLS подпись длиной 192 хекс-символа не обнаружена!")
            data["aggregated_signature"] = ""

        return data

# ==========================================
# ХЕЛПЕРЫ ДИНАМИЧЕСКОЙ ЗАГРУЗКИ SSL СЕРТИФИКАТОВ
# ==========================================
def load_ssl_context(data: Step4Input) -> ssl.SSLContext:
    home_dir = os.environ.get("USERPROFILE") or os.environ.get("HOME") or os.path.expanduser("~") or "C:\\Users\\khatk"
    
    cert_file = data.cert_path
    key_file = data.key_path

    if not cert_file or not key_file:
        ssl_dir = os.path.join(home_dir, ".chia", data.network, "config", "ssl", "full_node")
        cert_file = os.path.join(ssl_dir, "private_full_node.crt")
        key_file = os.path.join(ssl_dir, "private_full_node.key")

    if not os.path.exists(cert_file):
        ssl_dir = os.path.join(home_dir, ".chia", "mainnet", "config", "ssl", "full_node")
        cert_file = os.path.join(ssl_dir, "private_full_node.crt")
        key_file = os.path.join(ssl_dir, "private_full_node.key")

    if not os.path.exists(cert_file):
        raise FileNotFoundError(f"SSL-сертификаты ноды Chia не найдены. Проверенный путь: {cert_file}")

    ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.load_cert_chain(certfile=cert_file, keyfile=key_file)
    return ctx

# ==========================================
# ОСНОВНАЯ БИЗНЕС-ЛОГИКА ШАГА 4
# ==========================================
def run_step4(data: Step4Input) -> Dict[str, Any]:
    sig = data.aggregated_signature
    
    if not sig or sig == "":
        raise ValueError("Ошибка: Валидная BLS подпись (192 символа HEX) не найдена в структуре JSON запроса.")
        
    if not sig.startswith("0x"):
        sig = f"0x{sig}"

    formatted_coin_spends = []
    
    # ИСПРАВЛЕНИЕ: Маппим абсолютно ВСЕ переданные монеты из массива, не теряя мульти-коин инпуты
    for spend in data.coin_spends:
        c = spend.coin
        
        def format_hex(val: str) -> str:
            cleaned = val.strip()
            return f"0x{cleaned[2:] if cleaned.startswith(('0x', '0X')) else cleaned}"

        formatted_coin_spends.append({
            "coin": {
                "parent_coin_info": format_hex(c.parent_coin_info),
                "puzzle_hash": format_hex(c.puzzle_hash),
                "amount": int(c.amount)
            },
            "puzzle_reveal": format_hex(spend.puzzle_reveal),
            "solution": format_hex(spend.solution)
        })

    # Сборка канонического словаря SpendBundle для RPC ноды Chia
    spend_bundle = {
        "coin_spends": formatted_coin_spends,
        "aggregated_signature": sig
    }

    ssl_ctx = load_ssl_context(data)
    req_data = json.dumps({"spend_bundle": spend_bundle}).encode('utf-8')
    
    req = urllib.request.Request(
        f"{data.node_url.rstrip('/')}/push_tx",
        data=req_data,
        headers={'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req, context=ssl_ctx) as response:
            res_json = json.loads(response.read().decode('utf-8'))
            return res_json
    except Exception as e:
        raise RuntimeError(f"Сбой отправки RPC push_tx: {str(e)}")
