import os
import sys
from pathlib import Path
import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

# 🎯 ГАРАНТИРУЕМ ИЗОЛЯЦИЮ ПУТЕЙ ДЛЯ WINDOWS И UVICORN MULTIPROCESSING
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

# 🚀 Чистые атомарные импорты из твоих файлов
from wallets import wallet_router
from node import router as node_router
from transactions_build import tx_router as tx_build_router
from transactions_send import tx_router as tx_send_router
from transactions_track import transactions_track_router
from addresses_track import addresses_router

app = FastAPI(title="Chia Custom API Backend", version="1.0.0")

# Считываем секретный токен из переменных окружения Питона
PROXY_SECRET_TOKEN = os.getenv("PROXY_SECRET_TOKEN", "chia_wallet_ultra_secure_token_2026")

# 🎯 MIDDLEWARE ДЛЯ БЛОКИРОВКИ ПРЯМЫХ ЗАПРОСОВ
@app.middleware("http")
async def verify_proxy_request(request: Request, call_next):
    # Разрешаем прямой доступ без токена только для документации
    if request.url.path in ["/docs", "/openapi.json"]:
        return await call_next(request)
        
    # Вытаскиваем секретный заголовок, присланный прокси-роутом Next.js
    incoming_token = request.headers.get("x-proxy-secret")
    
    # Если токен не пришел или не совпал — возвращаем сухой стандартный отказ
    if incoming_token != PROXY_SECRET_TOKEN:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "detail": "Forbidden"
            }
        )
        
    # Если токен валидный — пропускаем запрос дальше к роутерам
    return await call_next(request)


# Базовый эндпоинт проверки жизнеспособности (защищен)
@app.get("/api/ping")
@app.head("/api/ping")
def ping():
    return {"status": "ok"}


# Подключаем модули движка кошелька
app.include_router(wallet_router)
app.include_router(node_router)

# Подключаем роутеры транзакций
app.include_router(tx_build_router)
app.include_router(tx_send_router)
app.include_router(transactions_track_router)

# 🎯 Подключаем твой новый роутер трекера адресов
app.include_router(addresses_router)

if __name__ == "__main__":
    uvicorn.run(
        "server:app",  
        host="127.0.0.1", 
        port=8000, 
        reload=True,
        app_dir=str(current_dir),  # Жестко прописывает Uvicorn рабочую директорию, убирая ModuleNotFoundError
        reload_dirs=["src/python"]
    )
