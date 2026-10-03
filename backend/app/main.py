import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine
from app.api import calls, appointments, plans, revenue, sales, services, staff, payments
from app.api import auth as auth_api, bitrix_app
from app.core.auth import current_user
from app.services.scheduler import create_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
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

# Все данные — только для вошедших пользователей (проверка в current_user)
_protected = [Depends(current_user)]

app.include_router(calls.router,        prefix="/api/calls",        tags=["calls"],        dependencies=_protected)
app.include_router(appointments.router, prefix="/api/appointments", tags=["appointments"], dependencies=_protected)
app.include_router(plans.router,        prefix="/api/plans",        tags=["plans"],        dependencies=_protected)
app.include_router(revenue.router,      prefix="/api/revenue",      tags=["revenue"],      dependencies=_protected)
app.include_router(sales.router,        prefix="/api/sales",        tags=["sales"],        dependencies=_protected)
app.include_router(services.router,     prefix="/api/services",     tags=["services"],     dependencies=_protected)
app.include_router(staff.router,        prefix="/api/staff",        tags=["staff"],        dependencies=_protected)
app.include_router(payments.router,     prefix="/api/payments",     tags=["payments"],     dependencies=_protected)

# Вход и служебное (без защиты токеном: auth/me сам проверяет, handler/install вызывает Битрикс24)
app.include_router(auth_api.router,     prefix="/api/auth",         tags=["auth"])
app.include_router(bitrix_app.router,   prefix="/bitrix",           tags=["bitrix"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "Labvita Stats API", "version": "0.2.0"}
