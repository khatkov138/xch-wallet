import os
import sys
import asyncio
from pathlib import Path
import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

# Атомарные импорты HTTP модулей кошелька
from wallets import wallet_router
from node import router as node_router
from transactions_build import tx_router as tx_build_router
from transactions_send import tx_router as tx_send_router
from transactions_track import transactions_track_router
from addresses_track import addresses_router

# Импорт изолированного WS модуля
from ws.websocket_engine import ws_router, manager

app = FastAPI(title="XCHIA Unified Backend Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NEXTJS_PROXY_SECRET_TOKEN = os.getenv("NEXTJS_PROXY_SECRET_TOKEN", "chia_wallet_ultra_secure_token_2026")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(manager.check_dead_mans_switch())

@app.middleware("http")
async def verify_proxy_request(request: Request, call_next):
    if request.url.path in ["/docs", "/openapi.json"] or request.method == "OPTIONS" or request.url.path.startswith("/ws"):
        return await call_next(request)
    if request.headers.get("x-proxy-secret") != NEXTJS_PROXY_SECRET_TOKEN:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"success": False, "detail": "Forbidden"})
    return await call_next(request)

@app.get("/api/ping")
@app.head("/api/ping")
def ping():
    return {"status": "ok"}

# Подключение HTTP роутеров
app.include_router(wallet_router)
app.include_router(node_router)
app.include_router(tx_build_router)
app.include_router(tx_send_router)
app.include_router(transactions_track_router)
app.include_router(addresses_router)

# Подключение WebSocket роутера
app.include_router(ws_router)

if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True, app_dir=str(current_dir))
