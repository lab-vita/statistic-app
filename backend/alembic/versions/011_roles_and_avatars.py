"""роли и фото сотрудников

Revision ID: 011
Revises: 010
Create Date: 2026-10-16

- app_roles — роли: название, описание, набор прав; owner встроенная
- app_users: avatar_url, position, profile_synced_at — фото и должность из Битрикс24
- access_requests: avatar_url, position

Сервер создаёт всё это и сам при старте (app/services/access.py), а при первом
запуске заводит роли по умолчанию и переводит на них сотрудников.
"""
import sqlalchemy as sa
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    return column in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("app_roles"):
        op.create_table(
            "app_roles",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=False, server_default=""),
            sa.Column("permissions", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
            sa.Column("system", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("position", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    for col in ("avatar_url", "position"):
        if not _has_column("app_users", col):
            op.add_column("app_users", sa.Column(col, sa.String(), nullable=True))
        if not _has_column("access_requests", col):
            op.add_column("access_requests", sa.Column(col, sa.String(), nullable=True))
    if not _has_column("app_users", "profile_synced_at"):
        op.add_column("app_users", sa.Column("profile_synced_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("app_users", "profile_synced_at")
    for col in ("avatar_url", "position"):
        op.drop_column("access_requests", col)
        op.drop_column("app_users", col)
    op.drop_table("app_roles")
