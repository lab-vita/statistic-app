"""обучающий тур: какую версию сотрудник уже прошёл

Revision ID: 013
Revises: 012
Create Date: 2026-10-16

app_users.tour_version — NULL, пока сотрудник не видел тур: при первом входе он
запускается сам. Сервер добавляет колонку и сам при старте (app/services/access.py).
"""
import sqlalchemy as sa
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("app_users")}
    if "tour_version" not in cols:
        op.add_column("app_users", sa.Column("tour_version", sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column("app_users", "tour_version")
