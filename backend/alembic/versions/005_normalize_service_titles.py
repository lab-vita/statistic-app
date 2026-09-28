"""normalize service_title in sales, backfill service_id

Revision ID: 005
Revises: 004
Create Date: 2026-09-28

Что делает эта миграция:
1. Нормализует sales.service_title:
   - strip() — убирает пробелы по краям
   - схлопывает двойные пробелы в одинарные
   - заменяет кириллические А→A, В→B, С→C в коде услуги
2. Заполняет sales.service_id через JOIN с services по нормализованному title.
   Покрывает ~183 из 192 уникальных несовпадений (~96% строк).
3. Обновляет sales.exclude_from_analytics из services.exclude_from_analytics.

Важно:
   Перед нормализацией проверяем дубликаты — строки, которые после нормализации
   стали бы одинаковыми (sale_date, service_title). Такие строки мержим:
   суммируем amount/total_sum/final_sum, оставляем одну запись, удаляем остальные.
   Это необходимо из-за уникального constraint uq_sale_date_service.

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
    # ── 0. Мержим строки, которые после нормализации стали бы дубликатами ────
    #
    # Алгоритм:
    #   a) Вычисляем нормализованный title для каждой строки (trim + collapse spaces + translate)
    #   b) Находим группы (sale_date, normalized_title) с COUNT > 1
    #   c) В каждой группе оставляем строку с MIN(id), к ней прибавляем суммы остальных
    #   d) Удаляем дублирующие строки (все кроме MIN(id))
    #
    # Нормализация здесь зеркальна шагам 1a-1c ниже.

    op.execute("""
        WITH normalized AS (
            SELECT
                id,
                sale_date,
                trim(regexp_replace(
                    translate(service_title, 'АВС', 'ABC'),
                    ' +', ' ', 'g'
                )) AS norm_title,
                amount,
                total_sum,
                final_sum,
                sum_percent
            FROM sales
        ),
        groups AS (
            SELECT sale_date, norm_title
            FROM normalized
            GROUP BY sale_date, norm_title
            HAVING COUNT(*) > 1
        ),
        duplicates AS (
            SELECT n.id, n.sale_date, n.norm_title,
                   MIN(n.id) OVER (PARTITION BY n.sale_date, n.norm_title) AS keep_id
            FROM normalized n
            JOIN groups g ON g.sale_date = n.sale_date AND g.norm_title = n.norm_title
        ),
        agg AS (
            SELECT
                keep_id,
                SUM(n.amount)      AS total_amount,
                SUM(n.total_sum)   AS total_total_sum,
                SUM(n.final_sum)   AS total_final_sum,
                MAX(n.sum_percent) AS max_sum_percent
            FROM duplicates d
            JOIN normalized n ON n.id = d.id
            GROUP BY keep_id
        )
        UPDATE sales s
        SET
            amount      = agg.total_amount,
            total_sum   = agg.total_total_sum,
            final_sum   = agg.total_final_sum,
            sum_percent = agg.max_sum_percent
        FROM agg
        WHERE s.id = agg.keep_id;
    """)

    # Удаляем дублирующие строки (все кроме MIN(id) в каждой группе)
    op.execute("""
        WITH normalized AS (
            SELECT
                id,
                sale_date,
                trim(regexp_replace(
                    translate(service_title, 'АВС', 'ABC'),
                    ' +', ' ', 'g'
                )) AS norm_title
            FROM sales
        ),
        groups AS (
            SELECT sale_date, norm_title
            FROM normalized
            GROUP BY sale_date, norm_title
            HAVING COUNT(*) > 1
        ),
        to_delete AS (
            SELECT n.id
            FROM normalized n
            JOIN groups g ON g.sale_date = n.sale_date AND g.norm_title = n.norm_title
            WHERE n.id != (
                SELECT MIN(n2.id)
                FROM normalized n2
                WHERE n2.sale_date = n.sale_date AND n2.norm_title = n.norm_title
            )
        )
        DELETE FROM sales WHERE id IN (SELECT id FROM to_delete);
    """)

    # ── 1. Нормализация sales.service_title ───────────────────────────────────

    # a) Убираем пробелы по краям
    op.execute("""
        UPDATE sales
        SET service_title = trim(service_title)
        WHERE service_title != trim(service_title);
    """)

    # b) Схлопываем двойные пробелы
    op.execute("""
        UPDATE sales
        SET service_title = regexp_replace(service_title, ' +', ' ', 'g')
        WHERE service_title ~ '  ';
    """)

    # c) Кириллица А/В/С → латиница A/B/C
    #    translate() заменяет символы побайтово — безопаснее regexp для Unicode.
    op.execute("""
        UPDATE sales
        SET service_title = translate(service_title, 'АВС', 'ABC')
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
