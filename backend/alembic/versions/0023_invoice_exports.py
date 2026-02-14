"""phase5 invoice exports tracking

Revision ID: 0023_invoice_exports
Revises: 0022_sales_invoice_core
Create Date: 2026-02-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0023_invoice_exports"
down_revision: Union[str, None] = "0022_sales_invoice_core"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "invoice_exports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("export_type", sa.String(length=24), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("document_id", sa.Integer(), nullable=True),
        sa.Column("validator_report_json", sa.JSON(), nullable=True),
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("export_type in ('xrechnung','zugferd')", name="invoice_exports_type_valid"),
        sa.CheckConstraint(
            "status in ('pending','generated','validation_error','failed')",
            name="invoice_exports_status_valid",
        ),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_invoice_exports_invoice_id", "invoice_exports", ["invoice_id"])
    op.create_index("ix_invoice_exports_export_type", "invoice_exports", ["export_type"])
    op.create_index("ix_invoice_exports_status", "invoice_exports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_invoice_exports_status", table_name="invoice_exports")
    op.drop_index("ix_invoice_exports_export_type", table_name="invoice_exports")
    op.drop_index("ix_invoice_exports_invoice_id", table_name="invoice_exports")
    op.drop_table("invoice_exports")
