import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.database import engine, Base
from app.api import calls, appointments, plans
from app.services.scheduler import create_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("[main] Планировщик запущен")
    yield
    scheduler.shutdown(wait=False)
    logger.info("[main] Планировщик остановлен")


app = FastAPI(title="Labvita Stats API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calls.router,        prefix="/api/calls",        tags=["calls"])
app.include_router(appointments.router, prefix="/api/appointments",  tags=["appointments"])
app.include_router(plans.router,        prefix="/api/plans",         tags=["plans"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "Labvita Stats API"}
