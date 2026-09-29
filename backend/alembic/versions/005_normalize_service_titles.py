"""normalize service_title in sales, backfill service_id

Revision ID: 005
Revises: 004
Create Date: 2026-09-28

Что делает эта миграция:
1. Полностью нормализует sales.service_title одним проходом:
   - trim — пробелы по краям
   - regexp_replace — двойные пробелы в одинарные
   - replace(chr()) — кириллические А→A, В→B, С→C
2. Перед нормализацией мержит все будущие дубли (суммирует числа, удаляет лишние).
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

# SQL-функция полной нормализации — используется одинаково в шагах 0 и 1.
# trim + схлопывание пробелов + кириллица А/В/С → A/B/C через chr().
_NORM_EXPR = """
    trim(
        replace(replace(replace(
            regexp_replace(service_title, ' +', ' ', 'g'),
            chr(1040), 'A'),
            chr(1042), 'B'),
            chr(1057), 'C')
    )
""".strip()

# То же для services.title
_NORM_SVC_EXPR = """
    trim(
        replace(replace(replace(
            regexp_replace(title, ' +', ' ', 'g'),
            chr(1040), 'A'),
            chr(1042), 'B'),
            chr(1057), 'C')
    )
""".strip()


def upgrade() -> None:
    # ── 0. Мержим все строки, которые после полной нормализации стали бы дублями
    #
    # Один CTE считает norm_title для каждой строки используя _NORM_EXPR.
    # Группы (sale_date, norm_title) с COUNT > 1 — это будущие дубли.
    # В каждой группе: оставляем MIN(id), суммируем к нему числа, остальные удаляем.

    op.execute(f"""
        WITH normalized AS (
            SELECT
                id,
                sale_date,
                {_NORM_EXPR} AS norm_title,
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
                SUM(n.amount)::int AS total_amount,
                SUM(n.total_sum)   AS total_total_sum,
                SUM(n.final_sum)   AS total_final_sum,
                MAX(n.sum_percent) AS max_sum_percent
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

    op.execute(f"""
        WITH normalized AS (
            SELECT id, sale_date, {_NORM_EXPR} AS norm_title
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

    # ── 1. Нормализуем service_title одним UPDATE (после удаления дублей) ────
    op.execute(f"""
        UPDATE sales
        SET service_title = {_NORM_EXPR}
        WHERE service_title != {_NORM_EXPR};
    """)

    # ── 2. Нормализуем services.title зеркально ───────────────────────────────
    op.execute(f"""
        UPDATE services
        SET title = {_NORM_SVC_EXPR}
        WHERE title != {_NORM_SVC_EXPR};
    """)

    # ── 3. Заполняем service_id + exclude_from_analytics ─────────────────────
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
    # Обратная нормализация невозможна — исходные строки потеряны.
    # Сбрасываем только вычислимые поля.
    op.execute("""
        UPDATE sales
        SET service_id = NULL, exclude_from_analytics = FALSE
        WHERE service_id IS NOT NULL;
    """)
