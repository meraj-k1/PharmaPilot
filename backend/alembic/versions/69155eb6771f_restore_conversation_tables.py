"""restore conversation tables

Revision ID: 69155eb6771f
Revises: 22e8000b6c49
Create Date: 2026-11-22 00:44:30.285670

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '69155eb6771f'
down_revision: Union[str, Sequence[str], None] = '22e8000b6c49'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
