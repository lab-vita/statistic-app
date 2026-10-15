"""шаблоны отчётов конструктора

Revision ID: 009
Revises: 008
Create Date: 2026-10-15

- report_templates — сохранённые отчёты раздела «Отчёты», общие для всех.

Сервер создаёт таблицу и сам при старте, если её нет, поэтому миграция
ничего не ломает, если её применят позже.
"""
import sqlalchemy as sa
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("report_templates"):
        return
    op.create_table(
        "report_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_by_id", sa.String(), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("report_templates")
