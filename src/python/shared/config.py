import os
import urllib3
from pathlib import Path

# Отключаем предупреждения о самоподписанных SSL-сертификатах Chia
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_RPC_URL = "https://localhost:8555"
API_SECRET = os.getenv("API_SECRET", "DEFAULT_FALLBACK_KEY_DO_NOT_USE_IN_PROD").encode("utf-8")

def get_ssl_credentials() -> tuple[str, str]:
    home = Path.home()
    root_path = home / ".chia/mainnet"
    config_file = root_path / "config/config.yaml"
    
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                if 'selected_network: "testnet11"' in f.read():
                    testnet_path = home / ".chia/testnet11"
                    if testnet_path.exists():
                        root_path = testnet_path
        except Exception as e:
            print(f"⚠️ [SSL AUTO] Не удалось прочитать config.yaml: {e}")
            
    c = root_path / "config/ssl/full_node/private_full_node.crt"
    k = root_path / "config/ssl/full_node/private_full_node.key"
    
    if c.exists() and k.exists(): 
        return str(c), str(k)
        
    current_net = "testnet11" if "testnet11" in str(root_path) else "mainnet"
    return (
        f"C:\\Users\\khatk\\.chia\\{current_net}\\config\\ssl\\full_node\\private_full_node.crt", 
        f"C:\\Users\\khatk\\.chia\\{current_net}\\config\\ssl\\full_node\\private_full_node.key"
    )
