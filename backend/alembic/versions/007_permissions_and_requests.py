"""права доступа сотрудников и запросы на доступ

Revision ID: 007
Revises: 006
Create Date: 2026-10-04

- app_users.permissions — список прав (JSON), по умолчанию пустой
- access_requests — кто пытался войти, но не был в списке
"""
import sqlalchemy as sa
from alembic import op

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "app_users",
        sa.Column("permissions", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.create_table(
        "access_requests",
        sa.Column("bitrix_user_id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, server_default=""),
        sa.Column("first_requested_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("last_requested_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("access_requests")
    op.drop_column("app_users", "permissions")
