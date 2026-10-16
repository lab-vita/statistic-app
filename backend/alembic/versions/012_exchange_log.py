"""журнал обмена с МедОДС и Битрикс24

Revision ID: 012
Revises: 011
Create Date: 2026-10-16

- sync_runs — сеансы обмена (запуск сборщика, рассылка сводки…)
- sync_requests — каждый запрос: параметры без секретов, ответ, описание данных

Сервер создаёт эти таблицы и сам при старте (app/services/exchange_log.py).
"""
import sqlalchemy as sa
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not insp.has_table("sync_runs"):
        op.create_table(
            "sync_runs",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("job", sa.String, nullable=False),
            sa.Column("title", sa.String, nullable=False, server_default=""),
            sa.Column("source", sa.String, nullable=False, server_default=""),
            sa.Column("trigger", sa.String, nullable=False, server_default=""),
            sa.Column("user_id", sa.String, nullable=True),
            sa.Column("user_name", sa.String, nullable=True),
            sa.Column("period_from", sa.Date, nullable=True),
            sa.Column("period_to", sa.Date, nullable=True),
            sa.Column("status", sa.String, nullable=False, server_default="running"),
            sa.Column("summary", sa.Text, nullable=False, server_default=""),
            sa.Column("result", sa.JSON, nullable=True),
            sa.Column("error", sa.Text, nullable=True),
            sa.Column("requests", sa.Integer, nullable=False, server_default="0"),
            sa.Column("failed", sa.Integer, nullable=False, server_default="0"),
            sa.Column("records", sa.Integer, nullable=False, server_default="0"),
            sa.Column("bytes", sa.BigInteger, nullable=False, server_default="0"),
            sa.Column("events", sa.JSON, nullable=False, server_default="[]"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_sync_runs_job", "sync_runs", ["job"])
        op.create_index("ix_sync_runs_status", "sync_runs", ["status"])
        op.create_index("ix_sync_runs_started_at", "sync_runs", ["started_at"])
    if not insp.has_table("sync_requests"):
        op.create_table(
            "sync_requests",
            sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
            sa.Column("run_id", sa.Integer, sa.ForeignKey("sync_runs.id", ondelete="CASCADE"), nullable=True),
            sa.Column("at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("source", sa.String, nullable=False),
            sa.Column("method", sa.String, nullable=False, server_default=""),
            sa.Column("endpoint", sa.String, nullable=False, server_default=""),
            sa.Column("url", sa.Text, nullable=False, server_default=""),
            sa.Column("title", sa.Text, nullable=False, server_default=""),
            sa.Column("params", sa.JSON, nullable=True),
            sa.Column("status_code", sa.Integer, nullable=True),
            sa.Column("ok", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("duration_ms", sa.Integer, nullable=False, server_default="0"),
            sa.Column("response_bytes", sa.Integer, nullable=False, server_default="0"),
            sa.Column("content_type", sa.String, nullable=False, server_default=""),
            sa.Column("records", sa.Integer, nullable=True),
            sa.Column("summary", sa.Text, nullable=False, server_default=""),
            sa.Column("fields", sa.JSON, nullable=True),
            sa.Column("body", sa.Text, nullable=True),
            sa.Column("body_truncated", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("error", sa.Text, nullable=True),
        )
        op.create_index("ix_sync_requests_run_id", "sync_requests", ["run_id"])
        op.create_index("ix_sync_requests_at", "sync_requests", ["at"])
        op.create_index("ix_sync_requests_source", "sync_requests", ["source"])


def downgrade() -> None:
    op.drop_table("sync_requests")
    op.drop_table("sync_runs")
