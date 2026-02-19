from decimal import Decimal

from app.models.inventory import Inventory
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.warehouse import BinResponse, WarehouseResponse, ZoneResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


def _to_warehouse_response(warehouse: Warehouse) -> WarehouseResponse:
    return WarehouseResponse(
        id=warehouse.id,
        code=warehouse.code,
        name=warehouse.name,
        address=warehouse.address,
        is_active=warehouse.is_active,
        created_at=warehouse.created_at,
        updated_at=warehouse.updated_at,
    )


def _to_zone_response(zone: WarehouseZone) -> ZoneResponse:
    return ZoneResponse(
        id=zone.id,
        warehouse_id=zone.warehouse_id,
        code=zone.code,
        name=zone.name,
        zone_type=zone.zone_type,
        is_active=zone.is_active,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )


def _to_bin_response(
    bin_location: BinLocation,
    *,
    occupied_quantity: Decimal = Decimal("0"),
) -> BinResponse:
    return BinResponse(
        id=bin_location.id,
        zone_id=bin_location.zone_id,
        code=bin_location.code,
        bin_type=bin_location.bin_type,
        max_weight=bin_location.max_weight,
        max_volume=bin_location.max_volume,
        qr_code_data=bin_location.qr_code_data,
        is_active=bin_location.is_active,
        is_occupied=occupied_quantity > 0,
        occupied_quantity=occupied_quantity,
        created_at=bin_location.created_at,
        updated_at=bin_location.updated_at,
    )


async def _get_bin_occupied_quantity(db: AsyncSession, bin_id: int) -> Decimal:
    quantity = (
        await db.execute(
            select(func.coalesce(func.sum(Inventory.quantity), 0)).where(
                Inventory.bin_location_id == bin_id
            )
        )
    ).scalar_one()
    return Decimal(quantity)
