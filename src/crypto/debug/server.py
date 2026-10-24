import sys
import logging
import json
from typing import Any, List, Dict
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uvicorn

from step1_get_coins import run_step1, Step1Input
from step2_build_clvm import run_step2, Step2Input
from step3_calc_hashes import run_step3, Step3Input
from step4_submit_tx import run_step4, Step4Input

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s", handlers=[logging.StreamHandler(sys.stdout)])
logger = logging.getLogger("CHIA_MINI")

app = FastAPI()

def shrink_data(obj: Any) -> Any:
    """Рекурсивно обрезает длинные hex-строки для читаемости логов"""
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
    logger.error(f"❌ 422 VALIDATION ERR: {json.dumps(err_body)}")
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=err_body)

async def log_io(endpoint: str, req_data: bytes, runner_func, input_model):
    try:
        req_json = json.loads(req_data) if req_data else {}
    except:
        req_json = {"raw": req_data.decode(errors='ignore')}
    
    logger.info(f"==> [{endpoint}] IN: {json.dumps(shrink_data(req_json), ensure_ascii=False)}")
    
    try:
        parsed_data = input_model(**req_json)
        result = runner_func(parsed_data)
        logger.info(f"<== [{endpoint}] OUT: {json.dumps(shrink_data(result), ensure_ascii=False)}")
        return result
    except Exception as e:
        err_clean = str(e).replace('\n', ' | ')
        logger.error(f"❌ <== [{endpoint}] ERR: {err_clean}")
        raise HTTPException(status_code=400, detail=err_clean)

@app.post("/step1")
async def step1_endpoint(request: Request): return await log_io("STEP1", await request.body(), run_step1, Step1Input)

@app.post("/step2")
async def step2_endpoint(request: Request): return await log_io("STEP2", await request.body(), run_step2, Step2Input)

@app.post("/step3")
async def step3_endpoint(request: Request): return await log_io("STEP3", await request.body(), run_step3, Step3Input)

@app.post("/step4")
async def step4_endpoint(request: Request): return await log_io("STEP4", await request.body(), run_step4, Step4Input)

if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
