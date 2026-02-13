from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class IntegrationClient(TimestampMixin, Base):
    __tablename__ = "integration_clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    client_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    secret_hash: Mapped[str] = mapped_column(String(255))
    scopes_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    token_ttl_minutes: Mapped[int] = mapped_column(Integer(), default=30, server_default="30")
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true", index=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    secret_rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)


class IntegrationAccessLog(Base):
    __tablename__ = "integration_access_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    integration_client_id: Mapped[int | None] = mapped_column(
        ForeignKey("integration_clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    endpoint: Mapped[str] = mapped_column(String(255), index=True)
    method: Mapped[str] = mapped_column(String(8), index=True)
    scope: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    status_code: Mapped[int] = mapped_column(Integer(), index=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text(), nullable=True)
    used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class LegacyMigrationRun(TimestampMixin, Base):
    __tablename__ = "legacy_migration_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_type: Mapped[str] = mapped_column(String(16), index=True)
    domain: Mapped[str] = mapped_column(String(32), index=True)
    source_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="running", server_default="running", index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    processed_records: Mapped[int] = mapped_column(Integer(), default=0, server_default="0")
    created_records: Mapped[int] = mapped_column(Integer(), default=0, server_default="0")
    updated_records: Mapped[int] = mapped_column(Integer(), default=0, server_default="0")
    error_records: Mapped[int] = mapped_column(Integer(), default=0, server_default="0")
    reconciliation_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)


class LegacyMigrationIssue(TimestampMixin, Base):
    __tablename__ = "legacy_migration_issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("legacy_migration_runs.id", ondelete="CASCADE"), index=True)
    domain: Mapped[str] = mapped_column(String(32), index=True)
    issue_code: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(16), default="error", server_default="error", index=True)
    message: Mapped[str] = mapped_column(Text())
    row_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class LegacyIdMap(TimestampMixin, Base):
    __tablename__ = "legacy_id_map"
    __table_args__ = (
        UniqueConstraint("domain", "legacy_id", "directstock_entity", name="uq_legacy_id_map_domain_legacy_entity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(32), index=True)
    legacy_id: Mapped[str] = mapped_column(String(128), index=True)
    directstock_entity: Mapped[str] = mapped_column(String(64), index=True)
    directstock_id: Mapped[int] = mapped_column(Integer(), index=True)
    run_id: Mapped[int | None] = mapped_column(
        ForeignKey("legacy_migration_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )


class LegacySupportRecord(TimestampMixin, Base):
    __tablename__ = "legacy_support_records"
    __table_args__ = (
        UniqueConstraint("record_type", "legacy_id", name="uq_legacy_support_record_type_legacy_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int | None] = mapped_column(
        ForeignKey("legacy_migration_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    record_type: Mapped[str] = mapped_column(String(64), index=True)
    legacy_id: Mapped[str] = mapped_column(String(128), index=True)
    source_table: Mapped[str] = mapped_column(String(128), index=True)
    record_key: Mapped[str] = mapped_column(String(128), index=True)
    record_value: Mapped[str | None] = mapped_column(Text(), nullable=True)
    status_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class LegacyRawRecord(TimestampMixin, Base):
    __tablename__ = "legacy_raw_records"
    __table_args__ = (
        UniqueConstraint("source_table", "row_key", name="uq_legacy_raw_records_source_table_row_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int | None] = mapped_column(
        ForeignKey("legacy_migration_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_table: Mapped[str] = mapped_column(String(128), index=True)
    source_file: Mapped[str] = mapped_column(String(255))
    row_key: Mapped[str] = mapped_column(String(255), index=True)
    row_key_source: Mapped[str] = mapped_column(String(64), default="legacy_id", server_default="legacy_id")
    row_hash: Mapped[str] = mapped_column(String(64), index=True)
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Shipment(TimestampMixin, Base):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    carrier: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(24), default="draft", server_default="draft", index=True)
    goods_issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("goods_issues.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tracking_number: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True, index=True)
    recipient_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shipping_address: Mapped[str | None] = mapped_column(Text(), nullable=True)
    label_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ShipmentEvent(TimestampMixin, Base):
    __tablename__ = "shipment_events"
    __table_args__ = (
        UniqueConstraint(
            "shipment_id",
            "event_type",
            "status",
            "event_at",
            "source",
            name="uq_shipment_events_uniqueness",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(24), index=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    event_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    source: Mapped[str] = mapped_column(String(32), default="system", server_default="system", index=True)
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)


class InterWarehouseTransfer(TimestampMixin, Base):
    __tablename__ = "inter_warehouse_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    from_warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id", ondelete="RESTRICT"), index=True)
    to_warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(24), default="draft", server_default="draft", index=True)
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)


class InterWarehouseTransferItem(TimestampMixin, Base):
    __tablename__ = "inter_warehouse_transfer_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    inter_warehouse_transfer_id: Mapped[int] = mapped_column(
        ForeignKey("inter_warehouse_transfers.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    from_bin_id: Mapped[int] = mapped_column(ForeignKey("bin_locations.id", ondelete="RESTRICT"), index=True)
    to_bin_id: Mapped[int] = mapped_column(ForeignKey("bin_locations.id", ondelete="RESTRICT"), index=True)
    requested_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    dispatched_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    batch_number: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    serial_numbers: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)


class ForecastRun(TimestampMixin, Base):
    __tablename__ = "forecast_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    date_from: Mapped[date] = mapped_column(Date(), index=True)
    date_to: Mapped[date] = mapped_column(Date(), index=True)
    lookback_days: Mapped[int] = mapped_column(Integer(), default=56, server_default="56")
    horizon_days_json: Mapped[list[int]] = mapped_column(JSON, default=list)
    algorithm_version: Mapped[str] = mapped_column(String(32), default="sma-v1", server_default="sma-v1")
    generated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)


class ForecastItem(TimestampMixin, Base):
    __tablename__ = "forecast_items"
    __table_args__ = (
        UniqueConstraint("run_id", "product_id", "warehouse_id", name="uq_forecast_items_run_product_warehouse"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    historical_mean: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    trend_slope: Mapped[Decimal] = mapped_column(Numeric(14, 6), default=0, server_default="0")
    confidence_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, server_default="0")
    history_days_used: Mapped[int] = mapped_column(Integer(), default=0, server_default="0")
    forecast_qty_7: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    forecast_qty_30: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    forecast_qty_90: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
