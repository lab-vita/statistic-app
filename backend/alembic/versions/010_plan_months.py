"""план на месяц

Revision ID: 010
Revises: 009
Create Date: 2026-10-16

- plan_months — то, что вводят на странице «Планы»: цифры на месяц, рабочие дни,
  выходные и поправленные вручную дни. Из них сервер раскладывает план по дням в plans.

Сервер создаёт таблицу и сам при старте, если её нет.
"""
import sqlalchemy as sa
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("plan_months"):
        return
    op.create_table(
        "plan_months",
        sa.Column("year", sa.Integer(), primary_key=True),
        sa.Column("month", sa.Integer(), primary_key=True),
        sa.Column("config", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    op.drop_table("plan_months")
