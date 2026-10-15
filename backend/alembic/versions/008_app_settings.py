"""настройки приложения (утренняя сводка)

Revision ID: 008
Revises: 007
Create Date: 2026-10-15

- app_settings — настройки, которые меняются из интерфейса (key → JSON).
  Первая запись — "digest": включена ли утренняя сводка, время, получатели, бот.

Сервер создаёт эту таблицу и сам при старте, если её нет, поэтому миграция
ничего не ломает, если её применят позже.
"""
import sqlalchemy as sa
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("app_settings"):
        return
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("value", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
