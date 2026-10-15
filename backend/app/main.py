import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine
from app.api import calls, appointments, plans, revenue, sales, services, staff, payments, reports
from app.api import admin as admin_api, auth as auth_api, bitrix_app
from app.core.auth import current_user, require_any
from app.services.scheduler import create_scheduler, setup_digest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = create_scheduler()
    scheduler.start()
    await setup_digest()
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

# Права на чтение данных. «Отчёты» строятся на данных звонков и записей,
# поэтому право view:reports открывает и их. Планы читает любой вошедший
# (они нужны на карточках), а менять планы — только с plans:edit (см. plans.py).
def _guard(*perms: str):
    return [Depends(require_any(*perms))]

app.include_router(calls.router,        prefix="/api/calls",        tags=["calls"],        dependencies=_guard("view:calls", "view:reports"))
app.include_router(appointments.router, prefix="/api/appointments", tags=["appointments"], dependencies=_guard("view:appointments", "view:reports"))
app.include_router(plans.router,        prefix="/api/plans",        tags=["plans"],        dependencies=[Depends(current_user)])
app.include_router(revenue.router,      prefix="/api/revenue",      tags=["revenue"],      dependencies=_guard("view:revenue"))
app.include_router(sales.router,        prefix="/api/sales",        tags=["sales"],        dependencies=_guard("view:revenue"))
app.include_router(services.router,     prefix="/api/services",     tags=["services"],     dependencies=_guard("view:revenue"))
app.include_router(staff.router,        prefix="/api/staff",        tags=["staff"],        dependencies=_guard("users:manage"))  # телефоны и почта сотрудников
app.include_router(payments.router,     prefix="/api/payments",     tags=["payments"],     dependencies=_guard("view:revenue"))
app.include_router(reports.router,      prefix="/api/reports",      tags=["reports"],      dependencies=_guard("view:reports"))
app.include_router(admin_api.router,    prefix="/api/admin",        tags=["admin"],        dependencies=_guard("users:manage"))

# Вход и служебное (без защиты токеном: auth/me сам проверяет, handler/install вызывает Битрикс24)
app.include_router(auth_api.router,     prefix="/api/auth",         tags=["auth"])
app.include_router(bitrix_app.router,   prefix="/bitrix",           tags=["bitrix"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "Labvita Stats API", "version": "0.2.0"}
