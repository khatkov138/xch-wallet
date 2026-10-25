import sys
import os
import logging
import json
import importlib.util
from typing import Any
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ANSI Цветовые коды для терминала Windows / Linux
C_RESET = "\033[0m"
C_BLUE = "\033[94m"
C_YELLOW = "\033[93m"
C_GREEN = "\033[92m"
C_RED = "\033[91m"
C_CYAN = "\033[96m"
C_MAGENTA = "\033[95m"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Настройка логирования
logging.basicConfig(
    level=logging.INFO, 
    format=f"{C_CYAN}%(asctime)s{C_RESET} | %(message)s", 
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("CHIA_MINI")

# =====================================================================
# ИМПОРТ МОДЕЛЕЙ ДАННЫХ (Pydantic схемы)
# =====================================================================
from step1_get_coins import Step1Input
from step2_build_clvm import Step2Input
from step3_calc_hashes import Step3Input
from step4_submit_tx import Step4Input

# =====================================================================
# ДИНАМИЧЕСКИЙ ЗАГРУЗЧИК ФАЙЛОВ ИЗ КОРНЯ
# =====================================================================
def force_load_file(file_name: str, func_name: str):
    absolute_path = os.path.normpath(os.path.join(BASE_DIR, file_name))
    
    if not os.path.exists(absolute_path):
        print(f"[PATH CHECK] {C_RED}ОШИБКА: Файл '{file_name}' НЕ НАЙДЕН. Ожидаемый путь: {absolute_path}{C_RESET}")
        return None
    try:
        module_name = f"mod_{file_name.split('.')[0]}"
        spec = importlib.util.spec_from_file_location(module_name, absolute_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        print(f"[PATH CHECK] {C_GREEN}УСПЕШНО: Файл '{file_name}' подключен по пути: {absolute_path}{C_RESET}")
        return getattr(mod, func_name)
    except Exception as e:
        logger.error(f"{C_RED}❌ Ошибка компиляции файла {file_name}: {str(e)}{C_RESET}")
        return None

# Принудительно связываем функции при старте из корня директории
print(f"\n{C_MAGENTA}=== ПРОВЕРКА НАЛИЧИЯ ИСПОЛНЯЕМЫХ ФАЙЛОВ ==={C_RESET}")
run_step1_func = force_load_file("step1_get_coins.py", "run_step1")
run_step2_func = force_load_file("step2_build_clvm.py", "run_step2")
run_step3_func = force_load_file("step3_calc_hashes.py", "run_step3")
run_step4_func = force_load_file("step4_submit_tx.py", "run_step4")
print(f"{C_MAGENTA}============================================\n{C_RESET}")

app = FastAPI()

# =====================================================================
# НАСТРОЙКА CORS
# =====================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def shrink_data(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: shrink_data(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [shrink_data(i) for i in obj]
    if isinstance(obj, str) and len(obj) > 50 and obj.startswith(("0x", "ff", "txch", "xch")):
        return f"{obj[:10]}...({len(obj)} chars)"
    return obj

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    err_body = {"route": request.url.path, "errors": exc.errors()}
    logger.error(f"{C_RED}❌ 422 VALIDATION ERR: {json.dumps(err_body)}{C_RESET}")
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=err_body)

# =====================================================================
# ЭНДПОИНТЫ
# =====================================================================

@app.post("/step1")
async def step1_endpoint(data: Step1Input): 
    if run_step1_func is None:
        raise HTTPException(status_code=500, detail="Файл 'step1_get_coins.py' отсутствует или не скомпилирован")
    try:
        logger.info(f"{C_GREEN}--- [RUN STEP 1] ---{C_RESET}")
        logger.info(f"{C_BLUE}Вход:{C_RESET} {json.dumps(shrink_data(data.model_dump()), ensure_ascii=False)}")
        result = run_step1_func(data)
        logger.info(f"{C_GREEN}Выход:{C_RESET} {json.dumps(shrink_data(result), ensure_ascii=False)}")
        return result
    except Exception as e:
        logger.error(f"{C_RED}Ошибка Шага 1: {str(e)}{C_RESET}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/step2")
async def step2_endpoint(data: Step2Input): 
    if run_step2_func is None:
        raise HTTPException(status_code=500, detail="Файл 'step2_build_clvm.py' отсутствует или не скомпилирован")
    try:
        logger.info(f"{C_GREEN}--- [RUN STEP 2] ---{C_RESET}")
        logger.info(f"{C_BLUE}Вход:{C_RESET} {json.dumps(shrink_data(data.model_dump()), ensure_ascii=False)}")
        result = run_step2_func(data)
        logger.info(f"{C_GREEN}Выход:{C_RESET} {json.dumps(shrink_data(result), ensure_ascii=False)}")
        return result
    except Exception as e:
        logger.error(f"{C_RED}Ошибка Шага 2: {str(e)}{C_RESET}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/step3")
async def step3_endpoint(data: Step3Input): 
    if run_step3_func is None:
        raise HTTPException(status_code=500, detail="Файл 'step3_calc_hashes.py' отсутствует или не скомпилирован")
    try:
        logger.info(f"{C_GREEN}--- [RUN STEP 3] ---{C_RESET}")
        logger.info(f"{C_BLUE}Вход:{C_RESET} {json.dumps(shrink_data(data.model_dump()), ensure_ascii=False)}")
        result = run_step3_func(data)
        logger.info(f"{C_GREEN}Выход:{C_RESET} {json.dumps(shrink_data(result), ensure_ascii=False)}")
        return result
    except Exception as e:
        logger.error(f"{C_RED}Ошибка Шага 3: {str(e)}{C_RESET}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/step4")
async def step4_endpoint(data: Step4Input): 
    if run_step4_func is None:
        raise HTTPException(status_code=500, detail="Файл 'step4_submit_tx.py' отсутствует или не скомпилирован")
    try:
        logger.info(f"{C_GREEN}--- [RUN STEP 4] ---{C_RESET}")
        logger.info(f"{C_BLUE}Вход:{C_RESET} {json.dumps(shrink_data(data.model_dump()), ensure_ascii=False)}")
        result = run_step4_func(data)
        logger.info(f"{C_GREEN}Выход:{C_RESET} {json.dumps(shrink_data(result), ensure_ascii=False)}")
        return result
    except Exception as e:
        logger.error(f"{C_RED}Ошибка Шага 4: {str(e)}{C_RESET}")
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
