"""раскладка главной хранится на сервере

Revision ID: 014
Revises: 013
Create Date: 2026-10-17

app_users.home_layout — виджеты главной сотрудника (JSON), одинаковые на любом
компьютере. NULL — раскладка по умолчанию. Сервер добавляет колонку и сам при старте
(app/services/access.py).
"""
import sqlalchemy as sa
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("app_users")}
    if "home_layout" not in cols:
        op.add_column("app_users", sa.Column("home_layout", sa.JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("app_users", "home_layout")
