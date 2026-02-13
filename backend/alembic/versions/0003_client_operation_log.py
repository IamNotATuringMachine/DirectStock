"""add client operation log

Revision ID: 0003_client_operation_log
Revises: 0002_customers_and_purchasing
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_client_operation_log"
down_revision: Union[str, None] = "0002_customers_and_purchasing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_operation_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("operation_id", sa.String(length=128), nullable=False),
        sa.Column("endpoint", sa.String(length=255), nullable=False),
        sa.Column("method", sa.String(length=8), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("operation_id", name="uq_client_operation_log_operation_id"),
    )
    op.create_index("ix_client_operation_log_operation_id", "client_operation_log", ["operation_id"])
    op.create_index("ix_client_operation_log_endpoint", "client_operation_log", ["endpoint"])
    op.create_index("ix_client_operation_log_method", "client_operation_log", ["method"])
    op.create_index("ix_client_operation_log_status_code", "client_operation_log", ["status_code"])
    op.create_index("ix_client_operation_log_created_at", "client_operation_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_client_operation_log_created_at", table_name="client_operation_log")
    op.drop_index("ix_client_operation_log_status_code", table_name="client_operation_log")
    op.drop_index("ix_client_operation_log_method", table_name="client_operation_log")
    op.drop_index("ix_client_operation_log_endpoint", table_name="client_operation_log")
    op.drop_index("ix_client_operation_log_operation_id", table_name="client_operation_log")
    op.drop_table("client_operation_log")
