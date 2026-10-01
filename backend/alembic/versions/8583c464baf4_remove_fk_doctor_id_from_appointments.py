"""remove fk doctor_id from appointments

Revision ID: 8583c464baf4
Revises: 2f49f1ed15f9
Create Date: 2026-09-27 06:21:55.881926

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8583c464baf4'
down_revision: Union[str, None] = '2f49f1ed15f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('fk_appointments_staff', 'appointments', type_='foreignkey')


def downgrade() -> None:
    op.create_foreign_key('fk_appointments_staff', 'appointments', 'staff', ['doctor_id'], ['id'], ondelete='SET NULL')