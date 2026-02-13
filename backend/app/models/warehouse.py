from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Warehouse(TimestampMixin, Base):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    address: Mapped[str | None] = mapped_column(Text())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class WarehouseZone(TimestampMixin, Base):
    __tablename__ = "warehouse_zones"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "code", name="uq_warehouse_zone_code"),
        CheckConstraint(
            "zone_type in ('inbound','storage','picking','outbound','returns','blocked','quality')",
            name="zone_type_valid",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(255))
    zone_type: Mapped[str] = mapped_column(String(32), default="storage", server_default="storage")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class BinLocation(TimestampMixin, Base):
    __tablename__ = "bin_locations"
    __table_args__ = (
        UniqueConstraint("zone_id", "code", name="uq_zone_bin_code"),
        CheckConstraint(
            "bin_type in ('inbound','storage','picking','outbound','returns','blocked','quality')",
            name="bin_type_valid",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("warehouse_zones.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(64), index=True)
    bin_type: Mapped[str] = mapped_column(String(32), default="storage", server_default="storage")
    max_weight: Mapped[Decimal | None] = mapped_column(Numeric(14, 3))
    max_volume: Mapped[Decimal | None] = mapped_column(Numeric(14, 3))
    qr_code_data: Mapped[str | None] = mapped_column(String(255), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
