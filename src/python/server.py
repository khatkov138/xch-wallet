import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from wallets import wallet_router
from transactions import tx_router

app = FastAPI(title="Chia Custom API Backend", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Обрабатывает GET-запрос от плашки мониторинга
@app.get("/api/ping")
# Обрабатывает HEAD-запрос от wait-on при старте
@app.head("/api/ping")
def ping():
    return {"status": "ok"}

app.include_router(wallet_router)
app.include_router(tx_router)

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["src/python"] # Если server.py лежит в src/python, можно просто "." или ["."]
    )