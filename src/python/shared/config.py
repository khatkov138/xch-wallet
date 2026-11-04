import os
import urllib3
from pathlib import Path

# Отключаем предупреждения о самоподписанных SSL-сертификатах Chia
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

API_SECRET = os.getenv("API_SECRET", "DEFAULT_FALLBACK_KEY_DO_NOT_USE_IN_PROD").encode("utf-8")

# Карта конфигураций для сетей
NETWORKS = {
    "mainnet": {
        "rpc_url": "https://localhost:8557",
        "dir_name": "real_mainnet"
    },
    "testnet11": {
        "rpc_url": "https://localhost:8555",
        "dir_name": "mainnet"  # Дефолтная папка чиа для тестнеты на вашей машине
    }
}

def get_network_config(network: str) -> dict:
    """
    Возвращает rpc_url, пути к crt и key для указанной сети (mainnet или testnet11).
    """
    net = str(network).lower()
    if net not in NETWORKS:
        raise ValueError(f"Неподдерживаемая сеть: {network}")
        
    cfg = NETWORKS[net]
    home = Path.home()
    root_path = home / f".chia/{cfg['dir_name']}"
    
    c = root_path / "config/ssl/full_node/private_full_node.crt"
    k = root_path / "config/ssl/full_node/private_full_node.key"
    
    # Если сертификаты по путям не найдены, генерируем фолбэк пути динамически без хардкода юзера
    if not (c.exists() and k.exists()):
        c = home / f".chia/{cfg['dir_name']}/config/ssl/full_node/private_full_node.crt"
        k = home / f".chia/{cfg['dir_name']}/config/ssl/full_node/private_full_node.key"
        
    return {
        "rpc_url": cfg["rpc_url"],
        "crt": str(c),
        "key": str(k)
    }
