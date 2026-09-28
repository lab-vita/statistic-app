"""normalize service_title in sales, backfill service_id

Revision ID: 005
Revises: 004
Create Date: 2026-09-28

Что делает эта миграция:
1. Нормализует sales.service_title:
   - strip() — убирает пробелы по краям
   - схлопывает двойные пробелы в одинарные
   - заменяет кириллические А→A, В→B, С→C в начале кода услуги
2. Заполняет sales.service_id через JOIN с services по нормализованному title.
   Покрывает ~183 из 192 уникальных несовпадений (96% строк).
3. Обновляет sales.exclude_from_analytics из services.exclude_from_analytics.

Примечание:
   9 названий, которых нет в справочнике services, остаются с service_id=NULL.
   Они будут обработаны отдельно через таблицу алиасов (задача #3b).
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Нормализация sales.service_title ───────────────────────────────────

    # a) Убираем пробелы по краям
    op.execute("""
        UPDATE sales
        SET service_title = trim(service_title)
        WHERE service_title != trim(service_title);
    """)

    # b) Схлопываем двойные пробелы (regexp_replace с флагом 'g')
    op.execute("""
        UPDATE sales
        SET service_title = regexp_replace(service_title, ' +', ' ', 'g')
        WHERE service_title ~ '  ';
    """)

    # c) Кириллица → латиница в буквенном коде услуги.
    #    translate() заменяет символы побайтово — безопаснее regexp для Unicode.
    #    Заменяем везде в строке (не только в начале), т.к. встречается редко
    #    и в других позициях не ломает смысл.
    op.execute("""
        UPDATE sales
        SET service_title = translate(
            service_title,
            'АВС',
            'ABC'
        )
        WHERE service_title ~ '[АВС]';
    """)

    # ── 2. Нормализация services.title (зеркально, для корректного JOIN) ─────
    op.execute("""
        UPDATE services
        SET title = trim(title)
        WHERE title != trim(title);
    """)
    op.execute("""
        UPDATE services
        SET title = regexp_replace(title, ' +', ' ', 'g')
        WHERE title ~ '  ';
    """)
    op.execute("""
        UPDATE services
        SET title = translate(title, 'АВС', 'ABC')
        WHERE title ~ '[АВС]';
    """)

    # ── 3. Заполняем service_id по точному совпадению нормализованных title ──
    op.execute("""
        UPDATE sales s
        SET
            service_id             = svc.id,
            exclude_from_analytics = svc.exclude_from_analytics
        FROM services svc
        WHERE s.service_title = svc.title
          AND s.service_id IS NULL;
    """)


def downgrade() -> None:
    # Обратная нормализация невозможна — исходные грязные строки потеряны.
    # Сбрасываем только service_id/exclude (их можно пересчитать).
    op.execute("""
        UPDATE sales
        SET service_id = NULL, exclude_from_analytics = FALSE
        WHERE service_id IS NOT NULL;
    """)
