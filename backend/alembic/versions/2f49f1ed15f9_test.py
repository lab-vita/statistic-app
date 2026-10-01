"""test

Revision ID: 2f49f1ed15f9
Revises: e35e9271e08e
Create Date: 2026-09-26 20:15:28.623461

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f49f1ed15f9'
down_revision: Union[str, None] = 'e35e9271e08e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f('ix_payment_details_client_id'), 'payment_details', ['client_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_payment_details_client_id'), table_name='payment_details')