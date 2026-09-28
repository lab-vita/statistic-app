"""normalize phones in calls/appointments, add call_id to appointments

Revision ID: 004
Revises: 003
Create Date: 2026-09-28

Что делает эта миграция:
1. Нормализует phone_number в таблице calls: +79... / 89... / 9... → 79...
2. Нормализует client_phone в таблице appointments аналогично
3. Добавляет поле call_id BIGINT NULL в appointments (индекс) — задел для матчинга
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Нормализация phone_number в calls ──────────────────────────────────
    # Шаги (порядок важен, иначе +7... → 7... → снова обрежет):
    #   a) +7XXXXXXXXXX  →  7XXXXXXXXXX   (убираем +)
    #   b) 8XXXXXXXXXX   →  7XXXXXXXXXX   (заменяем ведущую 8 на 7)
    #   c) XXXXXXXXXX    →  7XXXXXXXXXX   (10 цифр без кода → добавляем 7)
    op.execute("""
        UPDATE calls
        SET phone_number = regexp_replace(phone_number, '^\\+', '', 'g')
        WHERE phone_number ~ '^\\+';
    """)
    op.execute("""
        UPDATE calls
        SET phone_number = '7' || substring(phone_number FROM 2)
        WHERE phone_number ~ '^8[0-9]{10}$';
    """)
    op.execute("""
        UPDATE calls
        SET phone_number = '7' || phone_number
        WHERE phone_number ~ '^[0-9]{10}$';
    """)

    # ── 2. Нормализация client_phone в appointments ───────────────────────────
    op.execute("""
        UPDATE appointments
        SET client_phone = regexp_replace(client_phone, '^\\+', '', 'g')
        WHERE client_phone ~ '^\\+';
    """)
    op.execute("""
        UPDATE appointments
        SET client_phone = '7' || substring(client_phone FROM 2)
        WHERE client_phone ~ '^8[0-9]{10}$';
    """)
    op.execute("""
        UPDATE appointments
        SET client_phone = '7' || client_phone
        WHERE client_phone ~ '^[0-9]{10}$';
    """)

    # ── 3. Добавляем call_id в appointments ───────────────────────────────────
    op.add_column(
        "appointments",
        sa.Column(
            "call_id",
            sa.BigInteger(),
            nullable=True,
            comment="ID из таблицы calls — первый входящий звонок за 3 дня до записи",
        ),
    )
    op.create_index(
        "ix_appointments_call_id",
        "appointments",
        ["call_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_appointments_call_id", table_name="appointments")
    op.drop_column("appointments", "call_id")
    # Обратная нормализация телефонов намеренно не реализована:
    # исходные грязные форматы потеряны и восстановить их без источника невозможно.
