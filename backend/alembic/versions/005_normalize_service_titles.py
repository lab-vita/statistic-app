"""normalize service_title in sales, backfill service_id

Revision ID: 005
Revises: 004
Create Date: 2026-09-28

Что делает эта миграция:
1. Нормализует sales.service_title:
   - strip() — убирает пробелы по краям
   - схлопывает двойные пробелы в одинарные
   - заменяет кириллические А→A, В→B, С→C в коде услуги
2. Перед нормализацией мержит строки, которые после неё стали бы дубликатами
   (суммирует amount/total_sum/final_sum, удаляет лишние).
3. Заполняет sales.service_id через JOIN с services по нормализованному title.
4. Обновляет sales.exclude_from_analytics из services.

Примечание:
   9 названий без совпадения в services остаются с service_id=NULL.
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 0a. Сначала trim — это безопасно, не создаёт дублей само по себе ─────
    op.execute("""
        UPDATE sales
        SET service_title = trim(service_title)
        WHERE service_title != trim(service_title);
    """)

    # ── 0b. Мержим строки, которые после схлопывания пробелов стали бы дублями
    #
    # После trim могут остаться пары вида:
    #   (2026-06-13, 'А16.07.051 Гигиена  зубов')   ← двойной пробел
    #   (2026-06-13, 'А16.07.051 Гигиена зубов')    ← одиночный
    # После regexp_replace они стали бы одинаковыми → UniqueViolationError.
    #
    # Алгоритм:
    #   1. Вычисляем norm_title = regexp_replace(service_title, ' +', ' ', 'g')
    #   2. Группы (sale_date, norm_title) с COUNT > 1 — это будущие дубли
    #   3. В каждой группе оставляем MIN(id), суммируем числа к нему
    #   4. Удаляем остальные строки группы

    op.execute("""
        WITH normalized AS (
            SELECT
                id,
                sale_date,
                regexp_replace(service_title, ' +', ' ', 'g') AS norm_title,
                amount, total_sum, final_sum, sum_percent
            FROM sales
        ),
        dup_groups AS (
            SELECT sale_date, norm_title
            FROM normalized
            GROUP BY sale_date, norm_title
            HAVING COUNT(*) > 1
        ),
        keep_ids AS (
            SELECT sale_date, norm_title, MIN(id) AS keep_id
            FROM normalized
            WHERE (sale_date, norm_title) IN (SELECT sale_date, norm_title FROM dup_groups)
            GROUP BY sale_date, norm_title
        ),
        agg AS (
            SELECT
                k.keep_id,
                SUM(n.amount)::int    AS total_amount,
                SUM(n.total_sum)      AS total_total_sum,
                SUM(n.final_sum)      AS total_final_sum,
                MAX(n.sum_percent)    AS max_sum_percent
            FROM keep_ids k
            JOIN normalized n ON n.sale_date = k.sale_date AND n.norm_title = k.norm_title
            GROUP BY k.keep_id
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

    op.execute("""
        WITH normalized AS (
            SELECT
                id,
                sale_date,
                regexp_replace(service_title, ' +', ' ', 'g') AS norm_title
            FROM sales
        ),
        dup_groups AS (
            SELECT sale_date, norm_title
            FROM normalized
            GROUP BY sale_date, norm_title
            HAVING COUNT(*) > 1
        ),
        keep_ids AS (
            SELECT sale_date, norm_title, MIN(id) AS keep_id
            FROM normalized
            WHERE (sale_date, norm_title) IN (SELECT sale_date, norm_title FROM dup_groups)
            GROUP BY sale_date, norm_title
        ),
        to_delete AS (
            SELECT n.id
            FROM normalized n
            JOIN keep_ids k ON k.sale_date = n.sale_date AND k.norm_title = n.norm_title
            WHERE n.id != k.keep_id
        )
        DELETE FROM sales WHERE id IN (SELECT id FROM to_delete);
    """)

    # ── 1. Нормализация sales.service_title ───────────────────────────────────

    # b) Схлопываем двойные пробелы (дублей больше нет — безопасно)
    op.execute("""
        UPDATE sales
        SET service_title = regexp_replace(service_title, ' +', ' ', 'g')
        WHERE service_title LIKE '%  %';
    """)

    # c) Кириллица А/В/С → латиница A/B/C
    #    Используем replace() цепочкой — надёжнее translate() с многобайтными символами
    op.execute("""
        UPDATE sales
        SET service_title = replace(replace(replace(
            service_title,
            chr(1040), 'A'),   -- А (U+0410) → A
            chr(1042), 'B'),   -- В (U+0412) → B
            chr(1057), 'C')    -- С (U+0421) → C
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
        WHERE title LIKE '%  %';
    """)
    op.execute("""
        UPDATE services
        SET title = replace(replace(replace(
            title,
            chr(1040), 'A'),
            chr(1042), 'B'),
            chr(1057), 'C')
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
