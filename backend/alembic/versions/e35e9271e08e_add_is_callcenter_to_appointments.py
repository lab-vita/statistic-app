"""add is_callcenter to appointments

Revision ID: e35e9271e08e
Revises: 
Create Date: 2026-09-25 13:41:23.979587

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e35e9271e08e'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('appointments', sa.Column('is_callcenter', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index(op.f('ix_appointments_doctor_id'), 'appointments', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_appointments_is_callcenter'), 'appointments', ['is_callcenter'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_appointments_is_callcenter'), table_name='appointments')
    op.drop_index(op.f('ix_appointments_doctor_id'), table_name='appointments')
    op.drop_column('appointments', 'is_callcenter')