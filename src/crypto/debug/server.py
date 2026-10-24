import sys
import os
import logging
import json
import importlib.util
from typing import Any
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
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
# ИМПОРТ СТАРЫХ ВЕРСИЙ (ИЗ КОРНЯ ДИРЕКТОРИИ - WALLET RPC)
# =====================================================================
from step1_get_coins import run_step1, Step1Input
from step2_build_clvm import run_step2, Step2Input
from step3_calc_hashes import run_step3, Step3Input
from step4_submit_tx import run_step4, Step4Input

# =====================================================================
# ЖЕЛЕЗОБЕТОННЫЙ ЗАГРУЗЧИК С АБСОЛЮТНЫМ ВЫВОДОМ ИМЕНИ ФАЙЛА
# =====================================================================
def force_load_new_file(file_name: str, func_name: str):
    absolute_path = os.path.normpath(os.path.join(BASE_DIR, "new", file_name))
    
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

# Принудительно связываем функции при старте
print(f"\n{C_MAGENTA}=== ПРОВЕРКА НАЛИЧИЯ ФАЙЛОВ В ПАПКЕ /new ==={C_RESET}")
run_step1_new = force_load_new_file("step1_get_coins.py", "run_step1")
run_step2_new = force_load_new_file("step2_build_clvm.py", "run_step2")
run_step3_new = force_load_new_file("step3_calc_hashes.py", "run_step3")
run_step4_new = force_load_new_file("step4_submit_tx.py", "run_step4")
print(f"{C_MAGENTA}============================================\n{C_RESET}")

app = FastAPI()

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

async def log_and_compare(endpoint: str, req_data: bytes, old_runner, new_runner, runner_file_name, input_model):
    try:
        req_json = json.loads(req_data) if req_data else {}
    except:
        req_json = {"raw": req_data.decode(errors='ignore')}
    
    logger.info(f"{C_MAGENTA}======================================================={C_RESET}")
    logger.info(f"{C_BLUE}==> [{endpoint}] ВХОДЯЩИЙ ЗАПРОС:{C_RESET} {json.dumps(shrink_data(req_json), ensure_ascii=False)}")
    
    # 1. Выполнение старой RPC версии
    logger.info(f"{C_YELLOW}--- [RPC ВЕРСИЯ] СТАРТ ---{C_RESET}")
    try:
        parsed_data_old = input_model(**req_json)
        old_result = old_runner(parsed_data_old)
        logger.info(f"{C_YELLOW}<== [RPC ВЕРСИЯ] ВЫХОД:{C_RESET} {json.dumps(shrink_data(old_result), ensure_ascii=False)}")
    except Exception as e:
        old_result = {"error": str(e)}
        logger.error(f"{C_RED}❌ <== [RPC ВЕРСИЯ] ОШИБКА: {str(e)}{C_RESET}")

    # 2. Выполнение новой математической версии
    logger.info(f"{C_GREEN}--- [NEW ВЕРСИЯ (МАТЕМАТИКА В /NEW)] СТАРТ ---{C_RESET}")
    try:
        parsed_data_new = input_model(**req_json)
        if new_runner is None:
            logger.info(f"{C_GREEN}<== [NEW ВЕРСИЯ] ВЫХОД:{C_RESET} {C_RED}Файл 'new/{runner_file_name}' отсутствует на диске или функция не найдена{C_RESET}")
        else:
            new_result = new_runner(parsed_data_new)
            logger.info(f"{C_GREEN}<== [NEW ВЕРСИЯ] ВЫХОД:{C_RESET} {json.dumps(shrink_data(new_result), ensure_ascii=False)}")
    except Exception as e:
        logger.error(f"{C_RED}❌ <== [NEW ВЕРСИЯ] ОШИБКА: {str(e)}{C_RESET}")
        
    logger.info(f"{C_MAGENTA}======================================================={C_RESET}\n")
    
    if "error" in old_result:
        raise HTTPException(status_code=400, detail=old_result["error"].replace('\n', ' | '))
    return old_result

# =====================================================================
# ЭНДПОИНТЫ
# =====================================================================
# =====================================================================
# ЧИСТЫЕ ЭНДПОИНТЫ НА НОВЫЙ ЛАД (ТОЛЬКО /NEW БЕЗ WALLET RPC)
# =====================================================================

@app.post("/step1")
async def step1_endpoint(data: Step1Input): 
    if run_step1_new is None:
        raise HTTPException(status_code=500, detail="Файл 'new/step1_get_coins.py' отсутствует или не скомпилирован")
    try:
        logger.info(f"{C_GREEN}--- [RUN STEP 1 NEW] ---{C_RESET}")
        return run_step1_new(data)
    except Exception as e:
        logger.error(f"{C_RED}Ошибка Шага 1 NEW: {str(e)}{C_RESET}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/step2")
async def step2_endpoint(data: Step2Input): 
    if run_step2_new is None:
        raise HTTPException(status_code=500, detail="Файл 'new/step2_build_clvm.py' отсутствует или не скомпилирован")
    try:
        logger.info(f"{C_GREEN}--- [RUN STEP 2 NEW] ---{C_RESET}")
        return run_step2_new(data)
    except Exception as e:
        logger.error(f"{C_RED}Ошибка Шага 2 NEW: {str(e)}{C_RESET}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/step3")
async def step3_endpoint(data: Step3Input): 
    if run_step3_new is None:
        raise HTTPException(status_code=500, detail="Файл 'new/step3_calc_hashes.py' отсутствует или не скомпилирован")
    try:
        logger.info(f"{C_GREEN}--- [RUN STEP 3 NEW] ---{C_RESET}")
        return run_step3_new(data)
    except Exception as e:
        logger.error(f"{C_RED}Ошибка Шага 3 NEW: {str(e)}{C_RESET}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/step4")
async def step4_endpoint(data: Step4Input): 
    if run_step4_new is None:
        raise HTTPException(status_code=500, detail="Файл 'new/step4_submit_tx.py' отсутствует или не скомпилирован")
    try:
        logger.info(f"{C_GREEN}--- [RUN STEP 4 NEW] ---{C_RESET}")
        return run_step4_new(data)
    except Exception as e:
        logger.error(f"{C_RED}Ошибка Шага 4 NEW: {str(e)}{C_RESET}")
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
