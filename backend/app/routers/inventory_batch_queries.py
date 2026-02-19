from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Product
from app.models.inventory import InventoryBatch
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.inventory import InventoryBatchItem


async def inventory_batches_by_product_data(*, db: AsyncSession, product_id: int) -> list[InventoryBatchItem]:
    rows = (
        await db.execute(
            select(
                InventoryBatch.id.label("id"),
                Product.id.label("product_id"),
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                Warehouse.id.label("warehouse_id"),
                Warehouse.code.label("warehouse_code"),
                WarehouseZone.id.label("zone_id"),
                WarehouseZone.code.label("zone_code"),
                BinLocation.id.label("bin_id"),
                BinLocation.code.label("bin_code"),
                InventoryBatch.batch_number.label("batch_number"),
                InventoryBatch.expiry_date.label("expiry_date"),
                InventoryBatch.manufactured_at.label("manufactured_at"),
                InventoryBatch.quantity.label("quantity"),
                InventoryBatch.unit.label("unit"),
            )
            .join(Product, Product.id == InventoryBatch.product_id)
            .join(BinLocation, BinLocation.id == InventoryBatch.bin_location_id)
            .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
            .join(Warehouse, Warehouse.id == WarehouseZone.warehouse_id)
            .where(InventoryBatch.product_id == product_id)
            .where(InventoryBatch.quantity > 0)
            .order_by(
                Warehouse.code.asc(),
                WarehouseZone.code.asc(),
                BinLocation.code.asc(),
                InventoryBatch.expiry_date.is_(None),
                InventoryBatch.expiry_date.asc(),
                InventoryBatch.batch_number.asc(),
            )
        )
    ).all()

    return [
        InventoryBatchItem(
            id=row.id,
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            warehouse_id=row.warehouse_id,
            warehouse_code=row.warehouse_code,
            zone_id=row.zone_id,
            zone_code=row.zone_code,
            bin_id=row.bin_id,
            bin_code=row.bin_code,
            batch_number=row.batch_number,
            expiry_date=row.expiry_date,
            manufactured_at=row.manufactured_at,
            quantity=row.quantity,
            unit=row.unit,
        )
        for row in rows
    ]


async def inventory_batches_by_bin_data(*, db: AsyncSession, bin_id: int) -> list[InventoryBatchItem]:
    rows = (
        await db.execute(
            select(
                InventoryBatch.id.label("id"),
                Product.id.label("product_id"),
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                Warehouse.id.label("warehouse_id"),
                Warehouse.code.label("warehouse_code"),
                WarehouseZone.id.label("zone_id"),
                WarehouseZone.code.label("zone_code"),
                BinLocation.id.label("bin_id"),
                BinLocation.code.label("bin_code"),
                InventoryBatch.batch_number.label("batch_number"),
                InventoryBatch.expiry_date.label("expiry_date"),
                InventoryBatch.manufactured_at.label("manufactured_at"),
                InventoryBatch.quantity.label("quantity"),
                InventoryBatch.unit.label("unit"),
            )
            .join(Product, Product.id == InventoryBatch.product_id)
            .join(BinLocation, BinLocation.id == InventoryBatch.bin_location_id)
            .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
            .join(Warehouse, Warehouse.id == WarehouseZone.warehouse_id)
            .where(InventoryBatch.bin_location_id == bin_id)
            .where(InventoryBatch.quantity > 0)
            .order_by(
                Product.product_number.asc(),
                InventoryBatch.expiry_date.is_(None),
                InventoryBatch.expiry_date.asc(),
                InventoryBatch.batch_number.asc(),
            )
        )
    ).all()

    return [
        InventoryBatchItem(
            id=row.id,
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            warehouse_id=row.warehouse_id,
            warehouse_code=row.warehouse_code,
            zone_id=row.zone_id,
            zone_code=row.zone_code,
            bin_id=row.bin_id,
            bin_code=row.bin_code,
            batch_number=row.batch_number,
            expiry_date=row.expiry_date,
            manufactured_at=row.manufactured_at,
            quantity=row.quantity,
            unit=row.unit,
        )
        for row in rows
    ]
