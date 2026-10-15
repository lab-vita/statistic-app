"""
Конструктор отчётов и общие шаблоны.

GET    /api/reports/builder/schema   — источники, показатели и группировки, доступные пользователю
POST   /api/reports/builder/run      — посчитать отчёт
GET    /api/reports/builder/values   — значения группировки для фильтра «только …»
POST   /api/reports/builder/export   — выгрузить отчёт в xlsx или pdf
GET    /api/reports/templates        — сохранённые отчёты (общие)
POST   /api/reports/templates        — сохранить
PUT    /api/reports/templates/{id}   — переименовать / пересохранить
DELETE /api/reports/templates/{id}   — удалить (автор или тот, кто управляет доступом)
"""
from datetime import date
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, current_user
from app.db.database import get_db
from app.models.report_template import ReportTemplate
from app.services import report_export
from app.services.report_builder import ReportError, dimension_values, run_report, schema_for

router = APIRouter()


class ReportConfig(BaseModel):
    source: str
    metrics: list[str] = Field(min_length=1, max_length=12)
    group_by: list[str] = Field(default_factory=list, max_length=2)
    granularity: Literal["auto", "day", "week", "month"] = "auto"
    date_from: date
    date_to: date
    compare: bool = True
    filters: dict[str, list[str]] = Field(default_factory=dict)
    options: dict[str, str] = Field(default_factory=dict)


class ExportIn(BaseModel):
    config: ReportConfig
    format: Literal["xlsx", "pdf"]
    title: str = Field(default="Отчёт", max_length=200)


async def _run(db: AsyncSession, cfg: ReportConfig, user: CurrentUser) -> dict:
    try:
        return await run_report(db, cfg.model_dump(), user.has_any)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ReportError as e:
        raise HTTPException(400, str(e))


@router.get("/builder/schema")
async def builder_schema(user: CurrentUser = Depends(current_user)):
    return {"sources": schema_for(user.has_any)}


@router.post("/builder/run")
async def builder_run(cfg: ReportConfig, user: CurrentUser = Depends(current_user),
                      db: AsyncSession = Depends(get_db)):
    return await _run(db, cfg, user)


@router.get("/builder/values")
async def builder_values(
    source: str = Query(...), dimension: str = Query(...),
    date_from: date = Query(...), date_to: date = Query(...),
    date_basis: str | None = Query(default=None),
    user: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    try:
        values = await dimension_values(db, source, dimension, date_from, date_to, user.has_any,
                                        {"date_basis": date_basis} if date_basis else None)
    except ReportError as e:
        raise HTTPException(400, str(e))
    return {"values": values}


@router.post("/builder/export")
async def builder_export(body: ExportIn, user: CurrentUser = Depends(current_user),
                         db: AsyncSession = Depends(get_db)):
    rep = await _run(db, body.config, user)
    title = body.title.strip() or "Отчёт"
    if body.format == "xlsx":
        data = report_export.to_xlsx(rep, title)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        data = report_export.to_pdf(rep, title)
        media = "application/pdf"
    name = f"{report_export.file_stem(title, rep)}.{body.format}"
    return Response(content=data, media_type=media, headers={
        "Content-Disposition": f"attachment; filename=\"report.{body.format}\"; filename*=UTF-8''{quote(name)}",
        "Access-Control-Expose-Headers": "Content-Disposition",
    })


# ─── Шаблоны ─────────────────────────────────────────────────────────

class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    config: dict


class TemplatePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    config: dict | None = None


def _tpl_out(t: ReportTemplate, user: CurrentUser) -> dict:
    return {
        "id": t.id, "name": t.name, "config": t.config,
        "created_by": t.created_by_name,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "can_edit": _can_edit(t, user),
    }


def _can_edit(t: ReportTemplate, user: CurrentUser) -> bool:
    return user.has_any("users:manage") or (t.created_by_id is not None and t.created_by_id == user.id)


@router.get("/templates")
async def list_templates(user: CurrentUser = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(ReportTemplate).order_by(ReportTemplate.name))).all()
    return {"templates": [_tpl_out(t, user) for t in rows]}


@router.post("/templates")
async def create_template(body: TemplateIn, user: CurrentUser = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    t = ReportTemplate(name=body.name.strip(), config=body.config,
                       created_by_id=user.id, created_by_name=user.name)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _tpl_out(t, user)


@router.put("/templates/{tpl_id}")
async def update_template(tpl_id: int, body: TemplatePatch, user: CurrentUser = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    t = await db.get(ReportTemplate, tpl_id)
    if not t:
        raise HTTPException(404, "Шаблон не найден")
    if not _can_edit(t, user):
        raise HTTPException(403, "Менять шаблон может его автор или администратор доступа")
    if body.name is not None:
        t.name = body.name.strip()
    if body.config is not None:
        t.config = body.config
    await db.commit()
    await db.refresh(t)
    return _tpl_out(t, user)


@router.delete("/templates/{tpl_id}")
async def delete_template(tpl_id: int, user: CurrentUser = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    t = await db.get(ReportTemplate, tpl_id)
    if not t:
        raise HTTPException(404, "Шаблон не найден")
    if not _can_edit(t, user):
        raise HTTPException(403, "Удалить шаблон может его автор или администратор доступа")
    await db.delete(t)
    await db.commit()
    return {"status": "ok"}


async def create_tables(engine) -> None:
    """Создать report_templates, если миграцию ещё не применили (вызывается при старте)."""
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: ReportTemplate.__table__.create(c, checkfirst=True))
