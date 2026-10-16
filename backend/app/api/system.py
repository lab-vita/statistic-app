"""
Система: журнал обмена с МедОДС и Битрикс24 и выгрузка базы.

  /api/system/logs/…   — право logs:view
  /api/system/export/… — право data:export
Оба права по умолчанию только у владельца; выдать их другой роли может только он.
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import shutil
import tempfile
import zipfile
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, require_any
from app.core.config import settings
from app.db.database import engine, get_db
from app.models.exchange_log import SyncRequest, SyncRun
from app.services import exchange_log

logger = logging.getLogger(__name__)
router = APIRouter()

TZ = ZoneInfo("Asia/Krasnoyarsk")
_logs = require_any("logs:view")
_export = require_any("data:export")


# ─── Журнал ──────────────────────────────────────────────────

def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _run_out(r: SyncRun, with_events: bool = False) -> dict:
    out = {
        "id": r.id, "job": r.job, "title": r.title, "source": r.source,
        "source_label": exchange_log.SOURCES.get(r.source, r.source),
        "trigger": r.trigger, "trigger_label": exchange_log.TRIGGERS.get(r.trigger, r.trigger),
        "user_name": r.user_name,
        "period_from": r.period_from.isoformat() if r.period_from else None,
        "period_to": r.period_to.isoformat() if r.period_to else None,
        "status": r.status, "summary": r.summary, "error": r.error if with_events else None,
        "requests": r.requests, "failed": r.failed, "records": r.records, "bytes": r.bytes,
        "started_at": _iso(r.started_at), "finished_at": _iso(r.finished_at),
        "duration_ms": int((r.finished_at - r.started_at).total_seconds() * 1000) if r.finished_at else None,
        "has_error": bool(r.error),
    }
    if with_events:
        out["events"] = r.events or []
        out["result"] = r.result
    return out


def _req_out(q: SyncRequest, with_body: bool = False) -> dict:
    out = {
        "id": q.id, "run_id": q.run_id, "at": _iso(q.at), "source": q.source,
        "source_label": exchange_log.SOURCES.get(q.source, q.source),
        "method": q.method, "endpoint": q.endpoint, "title": q.title, "summary": q.summary,
        "status_code": q.status_code, "ok": q.ok, "duration_ms": q.duration_ms,
        "response_bytes": q.response_bytes, "records": q.records, "error": q.error,
        "has_body": q.body is not None,
    }
    if with_body:
        body, pretty = q.body, False
        if body and ("json" in q.content_type or body[:1] in "{[") and len(body) < 4_000_000:
            try:
                body = json.dumps(json.loads(body), ensure_ascii=False, indent=2)
                pretty = True
            except ValueError:
                pass
        out.update(url=q.url, params=q.params, content_type=q.content_type, fields=q.fields,
                   body=body, body_pretty=pretty, body_truncated=q.body_truncated)
    return out


def _day_range(date_from: date | None, date_to: date | None):
    lo = datetime.combine(date_from, time.min, TZ) if date_from else None
    hi = datetime.combine(date_to + timedelta(days=1), time.min, TZ) if date_to else None
    return lo, hi


@router.get("/logs/overview", dependencies=[Depends(_logs)])
async def overview(db: AsyncSession = Depends(get_db)):
    """Состояние сбора по каждому сборщику + объём журнала."""
    jobs = []
    for key, (title, source) in exchange_log.JOBS.items():
        last = (await db.execute(select(SyncRun).where(SyncRun.job == key)
                                 .order_by(SyncRun.id.desc()).limit(1))).scalar_one_or_none()
        last_ok = await db.scalar(select(func.max(SyncRun.finished_at))
                                  .where(SyncRun.job == key, SyncRun.status.in_(("ok", "warning"))))
        if last is None and key in ("sales_match", "resync", "services", "staff"):
            continue
        jobs.append({
            "job": key, "title": title, "source": source,
            "source_label": exchange_log.SOURCES.get(source, source),
            "last": _run_out(last) if last else None, "last_ok_at": _iso(last_ok),
        })
    since = datetime.now(TZ) - timedelta(hours=24)
    day = (await db.execute(select(
        func.count(SyncRequest.id),
        func.count(SyncRequest.id).filter(SyncRequest.ok.is_(False)),
        func.coalesce(func.sum(SyncRequest.response_bytes), 0),
    ).where(SyncRequest.at >= since))).one()
    size = (await db.execute(text(
        "SELECT coalesce(pg_total_relation_size('sync_requests'),0) + coalesce(pg_total_relation_size('sync_runs'),0)"
    ))).scalar()
    oldest = await db.scalar(select(func.min(SyncRequest.at)))
    return {
        "jobs": jobs,
        "day": {"requests": day[0], "failed": day[1], "bytes": int(day[2])},
        "storage_bytes": int(size or 0),
        "oldest_at": _iso(oldest),
        "keep_request_days": exchange_log.KEEP_REQUEST_DAYS,
        "keep_run_days": exchange_log.KEEP_RUN_DAYS,
        "max_body": exchange_log.MAX_BODY,
    }


@router.get("/logs/runs", dependencies=[Depends(_logs)])
async def runs(
    source: str | None = None,
    job: str | None = None,
    status: str | None = Query(None, description="ok / warning / error / running"),
    trigger: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    before: int | None = Query(None, description="id последнего показанного — для «Показать ещё»"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    cond = []
    if source:
        cond.append(SyncRun.source == source)
    if job:
        cond.append(SyncRun.job == job)
    if status == "problems":
        cond.append(SyncRun.status.in_(("warning", "error")))
    elif status:
        cond.append(SyncRun.status == status)
    if trigger:
        cond.append(SyncRun.trigger == trigger)
    lo, hi = _day_range(date_from, date_to)
    if lo:
        cond.append(SyncRun.started_at >= lo)
    if hi:
        cond.append(SyncRun.started_at < hi)
    if before:
        cond.append(SyncRun.id < before)
    rows = (await db.execute(select(SyncRun).where(and_(*cond)).order_by(SyncRun.id.desc())
                             .limit(limit + 1))).scalars().all()
    return {"runs": [_run_out(r) for r in rows[:limit]], "more": len(rows) > limit,
            "jobs": [{"job": k, "title": t} for k, (t, _) in exchange_log.JOBS.items()]}


@router.get("/logs/runs/{run_id}", dependencies=[Depends(_logs)])
async def run_detail(run_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.get(SyncRun, run_id)
    if r is None:
        raise HTTPException(404, "Сеанс не найден — возможно, уже удалён при очистке журнала")
    reqs = (await db.execute(select(SyncRequest).where(SyncRequest.run_id == run_id)
                             .order_by(SyncRequest.id))).scalars().all()
    return {"run": _run_out(r, with_events=True), "requests": [_req_out(q) for q in reqs]}


@router.get("/logs/requests", dependencies=[Depends(_logs)])
async def requests_list(
    run: str | None = Query(None, description="id сеанса или none — запросы вне сеансов"),
    source: str | None = None,
    only_errors: bool = False,
    q: str | None = Query(None, description="поиск по описанию, адресу и телу ответа"),
    date_from: date | None = None,
    date_to: date | None = None,
    before: int | None = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    cond = []
    if run == "none":
        cond.append(SyncRequest.run_id.is_(None))
    elif run:
        try:
            cond.append(SyncRequest.run_id == int(run))
        except ValueError:
            raise HTTPException(400, "run — номер сеанса или none") from None
    if source:
        cond.append(SyncRequest.source == source)
    if only_errors:
        cond.append(SyncRequest.ok.is_(False))
    if q and q.strip():
        like = f"%{q.strip()}%"
        cond.append(or_(SyncRequest.title.ilike(like), SyncRequest.summary.ilike(like),
                        SyncRequest.endpoint.ilike(like), SyncRequest.url.ilike(like),
                        SyncRequest.body.ilike(like)))
    lo, hi = _day_range(date_from, date_to)
    if lo:
        cond.append(SyncRequest.at >= lo)
    if hi:
        cond.append(SyncRequest.at < hi)
    if before:
        cond.append(SyncRequest.id < before)
    rows = (await db.execute(select(SyncRequest).where(and_(*cond)).order_by(SyncRequest.id.desc())
                             .limit(limit + 1))).scalars().all()
    return {"requests": [_req_out(x) for x in rows[:limit]], "more": len(rows) > limit}


@router.get("/logs/requests/{req_id}", dependencies=[Depends(_logs)])
async def request_detail(req_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.get(SyncRequest, req_id)
    if r is None:
        raise HTTPException(404, "Запрос не найден — возможно, уже удалён при очистке журнала")
    return _req_out(r, with_body=True)


@router.get("/logs/requests/{req_id}/body", dependencies=[Depends(_logs)])
async def request_body(req_id: int, db: AsyncSession = Depends(get_db)):
    r = await db.get(SyncRequest, req_id)
    if r is None or r.body is None:
        raise HTTPException(404, "Тело ответа не сохранено")
    ext = "json" if "json" in r.content_type else "html" if "html" in r.content_type else "txt"
    name = f"{r.source}-{r.id}-{r.at.astimezone(TZ):%Y%m%d-%H%M%S}.{ext}"
    return Response(r.body.encode("utf-8"), media_type=(r.content_type or "text/plain").split(";")[0] + "; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ─── Выгрузка базы ───────────────────────────────────────────

def _pg_dump() -> str | None:
    return shutil.which("pg_dump")


async def _pg_dump_version(binary: str) -> str:
    proc = await asyncio.create_subprocess_exec(binary, "--version", stdout=asyncio.subprocess.PIPE,
                                                stderr=asyncio.subprocess.PIPE)
    out, _ = await proc.communicate()
    return out.decode().strip()


def _sync_url():
    return make_url(settings.DATABASE_URL)


async def _tables(db: AsyncSession, exact: bool = False) -> list[dict]:
    rows = (await db.execute(text("""
        SELECT c.relname AS name,
               greatest(c.reltuples, 0)::bigint AS rows_estimate,
               pg_total_relation_size(c.oid) AS bytes
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
         ORDER BY pg_total_relation_size(c.oid) DESC
    """))).mappings().all()
    out = [dict(r) for r in rows]
    if exact:                                   # база небольшая — точный счёт быстрый
        for t in out:
            t["rows_estimate"] = int(await db.scalar(text(f'SELECT count(*) FROM public."{t["name"]}"')) or 0)
    return out


@router.get("/export/info", dependencies=[Depends(_export)])
async def export_info(db: AsyncSession = Depends(get_db)):
    binary = _pg_dump()
    server = await db.scalar(text("SHOW server_version"))
    total = await db.scalar(text("SELECT pg_database_size(current_database())"))
    return {
        "pg_dump": await _pg_dump_version(binary) if binary else None,
        "server_version": server,
        "database_bytes": int(total or 0),
        "tables": await _tables(db, exact=True),
        "log_tables": ["sync_requests"],
    }


def _stamp() -> str:
    return datetime.now(TZ).strftime("%Y-%m-%d_%H-%M")


def _cleanup(path: str) -> None:
    shutil.rmtree(path, ignore_errors=True)


async def _dump_sql(workdir: str, with_log: bool) -> str:
    binary = _pg_dump()
    if not binary:
        raise HTTPException(501, "На сервере нет pg_dump. Пересоберите контейнер backend "
                                 "(в Dockerfile.prod добавлен postgresql-client-16) или скачайте таблицы в CSV.")
    url = _sync_url()
    path = os.path.join(workdir, f"pulse-db-{_stamp()}.sql.gz")
    args = [binary, "--format=plain", "--compress=6", "--no-owner", "--no-privileges",
            "--encoding=UTF8", f"--file={path}",
            "-h", url.host or "localhost", "-p", str(url.port or 5432),
            "-U", url.username or "", "-d", url.database or ""]
    if not with_log:
        args.append("--exclude-table-data=sync_requests")
    env = {**os.environ, "PGPASSWORD": url.password or "", "PGCONNECT_TIMEOUT": "10"}
    proc = await asyncio.create_subprocess_exec(*args, env=env, stdout=asyncio.subprocess.PIPE,
                                                stderr=asyncio.subprocess.PIPE)
    _, err = await proc.communicate()
    if proc.returncode != 0:
        msg = err.decode("utf-8", "replace").strip()[-1500:]
        logger.error("[export] pg_dump: %s", msg)
        if "server version" in msg and "mismatch" in msg:
            msg = ("Версия pg_dump старше сервера базы. Пересоберите backend — в Dockerfile.prod "
                   "указан клиент той же версии, что и база. " + msg)
        raise HTTPException(500, f"pg_dump завершился с ошибкой: {msg}")
    return path


async def _dump_csv(workdir: str, with_log: bool, db: AsyncSession) -> str:
    tables = [t["name"] for t in await _tables(db) if with_log or t["name"] != "sync_requests"]
    path = os.path.join(workdir, f"pulse-tables-{_stamp()}.zip")
    counts: dict[str, int] = {}
    async with engine.connect() as conn:
        raw = await conn.get_raw_connection()
        pg = raw.driver_connection             # asyncpg.Connection
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for name in tables:
                part = os.path.join(workdir, f"{name}.csv")
                with open(part, "wb") as f:
                    f.write("﻿".encode("utf-8"))      # чтобы Excel узнал UTF-8
                    await pg.copy_from_table(name, schema_name="public", output=f, format="csv", header=True)
                counts[name] = await pg.fetchval(f'SELECT count(*) FROM public."{name}"')
                zf.write(part, f"{name}.csv")
                os.remove(part)
            readme = io.StringIO()
            readme.write(f"База «Пульс» на {datetime.now(TZ):%d.%m.%Y %H:%M} (Кемерово)\n")
            readme.write("Одна таблица — один CSV (UTF-8, разделитель — запятая, первая строка — названия колонок).\n")
            if not with_log:
                readme.write("Журнал запросов (sync_requests) не включён.\n")
            readme.write("\nТаблица;строк\n")
            w = csv.writer(readme, delimiter=";")
            for name in tables:
                w.writerow([name, counts.get(name, 0)])
            zf.writestr("README.txt", readme.getvalue())
    return path


@router.get("/export/db")
async def export_db(
    background: BackgroundTasks,
    fmt: str = Query("sql", alias="format", pattern="^(sql|csv)$"),
    with_log: bool = Query(False, alias="log", description="включить журнал запросов (может быть большим)"),
    user: CurrentUser = Depends(_export),
    db: AsyncSession = Depends(get_db),
):
    """sql — полная копия для восстановления (pg_dump, .sql.gz); csv — таблицы в CSV одним zip."""
    workdir = tempfile.mkdtemp(prefix="pulse-export-")
    background.add_task(_cleanup, workdir)          # удалить файл, когда он отдан
    logger.info("[export] %s (%s) выгружает базу: %s, журнал %s", user.name, user.id, fmt, with_log)
    try:
        path = await _dump_sql(workdir, with_log) if fmt == "sql" else await _dump_csv(workdir, with_log, db)
    except HTTPException:
        _cleanup(workdir)
        raise
    except Exception as exc:  # noqa: BLE001
        _cleanup(workdir)
        logger.error("[export] не удалось: %s", exc, exc_info=True)
        raise HTTPException(500, f"Не удалось выгрузить базу: {exc}") from None
    name = os.path.basename(path)
    media = "application/gzip" if fmt == "sql" else "application/zip"
    return FileResponse(path, media_type=media, filename=name, background=background)
