import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine
from app.api import calls, appointments, plans, revenue, sales, services, staff
from app.services.scheduler import create_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Жизненный цикл приложения.

    Создание таблиц — через Alembic (`alembic upgrade head` перед запуском).
    Base.metadata.create_all здесь нет намеренно: в production авто-креат не обновляет схему.
    """
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("[main] Планировщик запущен")
    yield
    scheduler.shutdown(wait=False)
    await engine.dispose()
    logger.info("[main] Планировщик остановлен")


app = FastAPI(title="Labvita Stats API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calls.router,        prefix="/api/calls",        tags=["calls"])
app.include_router(appointments.router, prefix="/api/appointments",  tags=["appointments"])
app.include_router(plans.router,        prefix="/api/plans",         tags=["plans"])
app.include_router(revenue.router,      prefix="/api/revenue",       tags=["revenue"])
app.include_router(sales.router,        prefix="/api/sales",         tags=["sales"])
app.include_router(services.router,     prefix="/api/services",      tags=["services"])
app.include_router(staff.router,        prefix="/api/staff",         tags=["staff"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "Labvita Stats API", "version": "0.2.0"}
