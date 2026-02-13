"""add shipping tables

Revision ID: 0013_shipping_carriers
Revises: 0012_legacy_migration
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0013_shipping_carriers"
down_revision: Union[str, None] = "0012_legacy_migration"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shipments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shipment_number", sa.String(length=64), nullable=False),
        sa.Column("carrier", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="draft"),
        sa.Column("goods_issue_id", sa.Integer(), nullable=True),
        sa.Column("tracking_number", sa.String(length=128), nullable=True),
        sa.Column("recipient_name", sa.String(length=255), nullable=True),
        sa.Column("shipping_address", sa.Text(), nullable=True),
        sa.Column("label_document_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("carrier in ('dhl','dpd','ups')", name="ck_shipments_carrier_valid"),
        sa.ForeignKeyConstraint(["goods_issue_id"], ["goods_issues.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["label_document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shipment_number"),
        sa.UniqueConstraint("tracking_number"),
    )
    op.create_index("ix_shipments_shipment_number", "shipments", ["shipment_number"])
    op.create_index("ix_shipments_carrier", "shipments", ["carrier"])
    op.create_index("ix_shipments_status", "shipments", ["status"])
    op.create_index("ix_shipments_goods_issue_id", "shipments", ["goods_issue_id"])
    op.create_index("ix_shipments_tracking_number", "shipments", ["tracking_number"])
    op.create_index("ix_shipments_label_document_id", "shipments", ["label_document_id"])
    op.create_index("ix_shipments_created_by", "shipments", ["created_by"])

    op.create_table(
        "shipment_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("shipment_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="system"),
        sa.Column("payload_json", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shipment_id", "event_type", "status", "event_at", "source", name="uq_shipment_events_uniqueness"),
    )
    op.create_index("ix_shipment_events_shipment_id", "shipment_events", ["shipment_id"])
    op.create_index("ix_shipment_events_event_type", "shipment_events", ["event_type"])
    op.create_index("ix_shipment_events_status", "shipment_events", ["status"])
    op.create_index("ix_shipment_events_event_at", "shipment_events", ["event_at"])
    op.create_index("ix_shipment_events_source", "shipment_events", ["source"])
    op.create_index("ix_shipment_events_created_by", "shipment_events", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_shipment_events_created_by", table_name="shipment_events")
    op.drop_index("ix_shipment_events_source", table_name="shipment_events")
    op.drop_index("ix_shipment_events_event_at", table_name="shipment_events")
    op.drop_index("ix_shipment_events_status", table_name="shipment_events")
    op.drop_index("ix_shipment_events_event_type", table_name="shipment_events")
    op.drop_index("ix_shipment_events_shipment_id", table_name="shipment_events")
    op.drop_table("shipment_events")

    op.drop_index("ix_shipments_created_by", table_name="shipments")
    op.drop_index("ix_shipments_label_document_id", table_name="shipments")
    op.drop_index("ix_shipments_tracking_number", table_name="shipments")
    op.drop_index("ix_shipments_goods_issue_id", table_name="shipments")
    op.drop_index("ix_shipments_status", table_name="shipments")
    op.drop_index("ix_shipments_carrier", table_name="shipments")
    op.drop_index("ix_shipments_shipment_number", table_name="shipments")
    op.drop_table("shipments")
