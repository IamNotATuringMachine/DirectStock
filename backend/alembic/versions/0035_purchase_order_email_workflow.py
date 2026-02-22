"""purchase order email workflow and supplier templates

Revision ID: 0035_purchase_order_email_workflow
Revises: 0034_wave3c_rbac_backfill
Create Date: 2026-02-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0035_purchase_order_email_workflow"
down_revision: Union[str, None] = "0034_wave3c_rbac_backfill"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "purchase_orders",
        sa.Column("supplier_comm_status", sa.String(length=32), nullable=False, server_default="open_unsent"),
    )
    op.add_column("purchase_orders", sa.Column("supplier_delivery_date", sa.Date(), nullable=True))
    op.add_column("purchase_orders", sa.Column("supplier_email_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "purchase_orders",
        sa.Column("supplier_reply_received_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("purchase_orders", sa.Column("supplier_last_reply_note", sa.Text(), nullable=True))
    op.add_column("purchase_orders", sa.Column("supplier_outbound_message_id", sa.String(length=255), nullable=True))
    op.add_column("purchase_orders", sa.Column("supplier_last_sync_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index(
        "ix_purchase_orders_supplier_comm_status",
        "purchase_orders",
        ["supplier_comm_status"],
        unique=False,
    )
    op.create_index(
        "ix_purchase_orders_supplier_outbound_message_id",
        "purchase_orders",
        ["supplier_outbound_message_id"],
        unique=False,
    )

    op.add_column("suppliers", sa.Column("purchase_email_salutation", sa.String(length=255), nullable=True))
    op.add_column("suppliers", sa.Column("purchase_email_subject_template", sa.Text(), nullable=True))
    op.add_column("suppliers", sa.Column("purchase_email_body_template", sa.Text(), nullable=True))
    op.add_column("suppliers", sa.Column("purchase_email_signature", sa.Text(), nullable=True))

    op.create_table(
        "purchase_order_email_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("purchase_order_id", sa.Integer(), nullable=False),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("message_id", sa.String(length=255), nullable=True),
        sa.Column("in_reply_to", sa.String(length=255), nullable=True),
        sa.Column("subject", sa.String(length=512), nullable=True),
        sa.Column("from_address", sa.String(length=255), nullable=True),
        sa.Column("to_address", sa.String(length=255), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("document_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("message_id", name="uq_purchase_order_email_events_message_id"),
    )
    op.create_index(
        "ix_purchase_order_email_events_purchase_order_id",
        "purchase_order_email_events",
        ["purchase_order_id"],
    )
    op.create_index(
        "ix_purchase_order_email_events_direction",
        "purchase_order_email_events",
        ["direction"],
    )
    op.create_index(
        "ix_purchase_order_email_events_event_type",
        "purchase_order_email_events",
        ["event_type"],
    )
    op.create_index(
        "ix_purchase_order_email_events_occurred_at",
        "purchase_order_email_events",
        ["occurred_at"],
    )
    op.create_index(
        "ix_purchase_order_email_events_document_id",
        "purchase_order_email_events",
        ["document_id"],
    )
    op.create_index(
        "ix_purchase_order_email_events_created_by",
        "purchase_order_email_events",
        ["created_by"],
    )

    op.execute(
        """
        UPDATE purchase_orders
        SET supplier_comm_status = CASE
            WHEN status IN ('ordered', 'partially_received', 'completed') THEN 'confirmed_undetermined'
            ELSE 'open_unsent'
        END
        """
    )


def downgrade() -> None:
    op.drop_index("ix_purchase_order_email_events_created_by", table_name="purchase_order_email_events")
    op.drop_index("ix_purchase_order_email_events_document_id", table_name="purchase_order_email_events")
    op.drop_index("ix_purchase_order_email_events_occurred_at", table_name="purchase_order_email_events")
    op.drop_index("ix_purchase_order_email_events_event_type", table_name="purchase_order_email_events")
    op.drop_index("ix_purchase_order_email_events_direction", table_name="purchase_order_email_events")
    op.drop_index("ix_purchase_order_email_events_purchase_order_id", table_name="purchase_order_email_events")
    op.drop_table("purchase_order_email_events")

    op.drop_column("suppliers", "purchase_email_signature")
    op.drop_column("suppliers", "purchase_email_body_template")
    op.drop_column("suppliers", "purchase_email_subject_template")
    op.drop_column("suppliers", "purchase_email_salutation")

    op.drop_index("ix_purchase_orders_supplier_outbound_message_id", table_name="purchase_orders")
    op.drop_index("ix_purchase_orders_supplier_comm_status", table_name="purchase_orders")

    op.drop_column("purchase_orders", "supplier_last_sync_at")
    op.drop_column("purchase_orders", "supplier_outbound_message_id")
    op.drop_column("purchase_orders", "supplier_last_reply_note")
    op.drop_column("purchase_orders", "supplier_reply_received_at")
    op.drop_column("purchase_orders", "supplier_email_sent_at")
    op.drop_column("purchase_orders", "supplier_delivery_date")
    op.drop_column("purchase_orders", "supplier_comm_status")
