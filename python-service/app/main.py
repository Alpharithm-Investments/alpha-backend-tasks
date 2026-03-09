from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.sample_items import router as sample_items_router
from app.api import briefings as briefings_router

app = FastAPI(title="InsightOps Starter Service", version="0.1.0")

app.include_router(health_router)
app.include_router(sample_items_router)
app.include_router(briefings_router.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "InsightOps", "status": "starter-ready"}
