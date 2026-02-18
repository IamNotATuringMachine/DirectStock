from datetime import UTC, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.inventory import Inventory, InventoryBatch, SerialNumber, StockMovement
from app.models.phase4 import InterWarehouseTransfer, InterWarehouseTransferItem
from app.models.warehouse import BinLocation, WarehouseZone
from app.schemas.phase4 import (
    InterWarehouseTransferCreate,
    InterWarehouseTransferDetailResponse,
    InterWarehouseTransferItemCreate,
    InterWarehouseTransferItemResponse,
    InterWarehouseTransferResponse,
)
from app.schemas.user import MessageResponse
from app.utils.http_status import HTTP_422_UNPROCESSABLE

router = APIRouter(prefix="/api/inter-warehouse-transfers", tags=["inter-warehouse-transfers"])

INTER_WAREHOUSE_TRANSFER_READ_PERMISSION = "module.inter_warehouse_transfers.read"
INTER_WAREHOUSE_TRANSFER_WRITE_PERMISSION = "module.inter_warehouse_transfers.write"


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _normalize_serial_numbers(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    return sorted({item.strip() for item in raw if item and item.strip()})


def _ensure_quantity_matches_serials(quantity: Decimal, serial_numbers: list[str], *, item_label: str) -> None:
    if serial_numbers and quantity != Decimal(len(serial_numbers)):
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail=f"{item_label} quantity must equal number of serial numbers",
        )


async def _warehouse_id_for_bin(db: AsyncSession, bin_id: int) -> int:
    row = (
        await db.execute(
            select(WarehouseZone.warehouse_id)
            .join(BinLocation, BinLocation.zone_id == WarehouseZone.id)
            .where(BinLocation.id == bin_id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Bin {bin_id} not found")
    return int(row)


async def _get_inventory(db: AsyncSession, *, product_id: int, bin_location_id: int, unit: str) -> Inventory:
    item = (
        await db.execute(
            select(Inventory).where(
                Inventory.product_id == product_id,
                Inventory.bin_location_id == bin_location_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        item = Inventory(product_id=product_id, bin_location_id=bin_location_id, quantity=Decimal("0"), unit=unit)
        db.add(item)
        await db.flush()
    return item


async def _get_inventory_batch(
    db: AsyncSession,
    *,
    product_id: int,
    bin_location_id: int,
    batch_number: str,
    unit: str,
) -> InventoryBatch:
    item = (
        await db.execute(
            select(InventoryBatch).where(
                InventoryBatch.product_id == product_id,
                InventoryBatch.bin_location_id == bin_location_id,
                InventoryBatch.batch_number == batch_number,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        item = InventoryBatch(
            product_id=product_id,
            bin_location_id=bin_location_id,
            batch_number=batch_number,
            quantity=Decimal("0"),
            unit=unit,
        )
        db.add(item)
        await db.flush()
    return item


def _to_transfer_response(item: InterWarehouseTransfer) -> InterWarehouseTransferResponse:
    return InterWarehouseTransferResponse(
        id=item.id,
        transfer_number=item.transfer_number,
        from_warehouse_id=item.from_warehouse_id,
        to_warehouse_id=item.to_warehouse_id,
        status=item.status,
        requested_at=item.requested_at,
        dispatched_at=item.dispatched_at,
        received_at=item.received_at,
        cancelled_at=item.cancelled_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_item_response(item: InterWarehouseTransferItem) -> InterWarehouseTransferItemResponse:
    return InterWarehouseTransferItemResponse(
        id=item.id,
        inter_warehouse_transfer_id=item.inter_warehouse_transfer_id,
        product_id=item.product_id,
        from_bin_id=item.from_bin_id,
        to_bin_id=item.to_bin_id,
        requested_quantity=item.requested_quantity,
        dispatched_quantity=item.dispatched_quantity,
        received_quantity=item.received_quantity,
        unit=item.unit,
        batch_number=item.batch_number,
        serial_numbers=item.serial_numbers,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=list[InterWarehouseTransferResponse])
async def list_inter_warehouse_transfers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INTER_WAREHOUSE_TRANSFER_READ_PERMISSION)),
) -> list[InterWarehouseTransferResponse]:
    rows = list(
        (
            await db.execute(
                select(InterWarehouseTransfer)
                .order_by(InterWarehouseTransfer.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )
    return [_to_transfer_response(row) for row in rows]


@router.post("", response_model=InterWarehouseTransferResponse, status_code=status.HTTP_201_CREATED)
async def create_inter_warehouse_transfer(
    payload: InterWarehouseTransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(INTER_WAREHOUSE_TRANSFER_WRITE_PERMISSION)),
) -> InterWarehouseTransferResponse:
    if payload.from_warehouse_id == payload.to_warehouse_id:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="from_warehouse_id and to_warehouse_id must differ")

    item = InterWarehouseTransfer(
        transfer_number=payload.transfer_number or _generate_number("IWT"),
        from_warehouse_id=payload.from_warehouse_id,
        to_warehouse_id=payload.to_warehouse_id,
        status="draft",
        requested_at=_now(),
        created_by=current_user.id,
        notes=payload.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_transfer_response(item)


@router.get("/{transfer_id}", response_model=InterWarehouseTransferDetailResponse)
async def get_inter_warehouse_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INTER_WAREHOUSE_TRANSFER_READ_PERMISSION)),
) -> InterWarehouseTransferDetailResponse:
    transfer = (
        await db.execute(select(InterWarehouseTransfer).where(InterWarehouseTransfer.id == transfer_id))
    ).scalar_one_or_none()
    if transfer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inter-warehouse transfer not found")

    items = list(
        (
            await db.execute(
                select(InterWarehouseTransferItem)
                .where(InterWarehouseTransferItem.inter_warehouse_transfer_id == transfer_id)
                .order_by(InterWarehouseTransferItem.id.asc())
            )
        ).scalars()
    )
    return InterWarehouseTransferDetailResponse(transfer=_to_transfer_response(transfer), items=[_to_item_response(item) for item in items])


@router.post("/{transfer_id}/items", response_model=InterWarehouseTransferItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inter_warehouse_transfer_item(
    transfer_id: int,
    payload: InterWarehouseTransferItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INTER_WAREHOUSE_TRANSFER_WRITE_PERMISSION)),
) -> InterWarehouseTransferItemResponse:
    transfer = (
        await db.execute(select(InterWarehouseTransfer).where(InterWarehouseTransfer.id == transfer_id))
    ).scalar_one_or_none()
    if transfer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inter-warehouse transfer not found")
    if transfer.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer is not editable")

    source_wh = await _warehouse_id_for_bin(db, payload.from_bin_id)
    target_wh = await _warehouse_id_for_bin(db, payload.to_bin_id)
    if source_wh != transfer.from_warehouse_id:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="from_bin_id does not belong to source warehouse")
    if target_wh != transfer.to_warehouse_id:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="to_bin_id does not belong to target warehouse")

    serial_numbers = _normalize_serial_numbers(payload.serial_numbers)
    _ensure_quantity_matches_serials(Decimal(payload.requested_quantity), serial_numbers, item_label="Transfer item")

    item = InterWarehouseTransferItem(
        inter_warehouse_transfer_id=transfer_id,
        product_id=payload.product_id,
        from_bin_id=payload.from_bin_id,
        to_bin_id=payload.to_bin_id,
        requested_quantity=payload.requested_quantity,
        dispatched_quantity=Decimal("0"),
        received_quantity=Decimal("0"),
        unit=payload.unit,
        batch_number=payload.batch_number,
        serial_numbers=serial_numbers or None,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_item_response(item)


@router.post("/{transfer_id}/dispatch", response_model=MessageResponse)
async def dispatch_inter_warehouse_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(INTER_WAREHOUSE_TRANSFER_WRITE_PERMISSION)),
) -> MessageResponse:
    transfer = (
        await db.execute(select(InterWarehouseTransfer).where(InterWarehouseTransfer.id == transfer_id))
    ).scalar_one_or_none()
    if transfer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inter-warehouse transfer not found")
    if transfer.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer cannot be dispatched")

    items = list(
        (
            await db.execute(
                select(InterWarehouseTransferItem).where(InterWarehouseTransferItem.inter_warehouse_transfer_id == transfer_id)
            )
        ).scalars()
    )
    if not items:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Transfer has no items")

    now = _now()
    try:
        for item in items:
            quantity = Decimal(item.requested_quantity)
            serial_numbers = _normalize_serial_numbers(item.serial_numbers)
            _ensure_quantity_matches_serials(quantity, serial_numbers, item_label=f"Transfer item {item.id}")

            source_inventory = (
                await db.execute(
                    select(Inventory).where(
                        Inventory.product_id == item.product_id,
                        Inventory.bin_location_id == item.from_bin_id,
                    )
                )
            ).scalar_one_or_none()
            if source_inventory is None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Insufficient stock for transfer item {item.id}")

            available_quantity = Decimal(source_inventory.quantity) - Decimal(source_inventory.reserved_quantity)
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for transfer item {item.id} (available={available_quantity}, requested={quantity})",
                )

            source_inventory.quantity = Decimal(source_inventory.quantity) - quantity

            if item.batch_number:
                source_batch = (
                    await db.execute(
                        select(InventoryBatch).where(
                            InventoryBatch.product_id == item.product_id,
                            InventoryBatch.bin_location_id == item.from_bin_id,
                            InventoryBatch.batch_number == item.batch_number,
                        )
                    )
                ).scalar_one_or_none()
                if source_batch is None or Decimal(source_batch.quantity) < quantity:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Insufficient batch stock for transfer item {item.id}")
                source_batch.quantity = Decimal(source_batch.quantity) - quantity

            if serial_numbers:
                serial_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber).where(
                                SerialNumber.serial_number.in_(serial_numbers),
                                SerialNumber.product_id == item.product_id,
                            )
                        )
                    ).scalars()
                )
                serial_map = {row.serial_number: row for row in serial_rows}
                missing = [serial for serial in serial_numbers if serial not in serial_map]
                if missing:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial number not found: {missing[0]}")

                for serial in serial_numbers:
                    serial_row = serial_map[serial]
                    if serial_row.status != "in_stock" or serial_row.current_bin_id != item.from_bin_id:
                        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial number {serial} is not available at source bin")
                    serial_row.status = "in_transit"
                    serial_row.current_bin_id = None
                    serial_row.last_movement_at = now

            item.dispatched_quantity = quantity

            db.add(
                StockMovement(
                    movement_type="inter_warehouse_dispatch",
                    reference_type="inter_warehouse_transfer",
                    reference_number=transfer.transfer_number,
                    product_id=item.product_id,
                    from_bin_id=item.from_bin_id,
                    to_bin_id=None,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "inter_warehouse_transfer_id": transfer.id,
                        "inter_warehouse_transfer_item_id": item.id,
                        "batch_number": item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )

        transfer.status = "dispatched"
        transfer.dispatched_at = now
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="inter-warehouse transfer dispatched")


@router.post("/{transfer_id}/receive", response_model=MessageResponse)
async def receive_inter_warehouse_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(INTER_WAREHOUSE_TRANSFER_WRITE_PERMISSION)),
) -> MessageResponse:
    transfer = (
        await db.execute(select(InterWarehouseTransfer).where(InterWarehouseTransfer.id == transfer_id))
    ).scalar_one_or_none()
    if transfer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inter-warehouse transfer not found")
    if transfer.status != "dispatched":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer cannot be received")

    items = list(
        (
            await db.execute(
                select(InterWarehouseTransferItem).where(InterWarehouseTransferItem.inter_warehouse_transfer_id == transfer_id)
            )
        ).scalars()
    )
    if not items:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Transfer has no items")

    now = _now()
    try:
        for item in items:
            quantity = Decimal(item.dispatched_quantity or item.requested_quantity)
            if quantity <= 0:
                quantity = Decimal(item.requested_quantity)

            target_inventory = await _get_inventory(
                db,
                product_id=item.product_id,
                bin_location_id=item.to_bin_id,
                unit=item.unit,
            )
            target_inventory.quantity = Decimal(target_inventory.quantity) + quantity

            if item.batch_number:
                target_batch = await _get_inventory_batch(
                    db,
                    product_id=item.product_id,
                    bin_location_id=item.to_bin_id,
                    batch_number=item.batch_number,
                    unit=item.unit,
                )
                target_batch.quantity = Decimal(target_batch.quantity) + quantity

            serial_numbers = _normalize_serial_numbers(item.serial_numbers)
            if serial_numbers:
                serial_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber).where(
                                SerialNumber.serial_number.in_(serial_numbers),
                                SerialNumber.product_id == item.product_id,
                            )
                        )
                    ).scalars()
                )
                serial_map = {row.serial_number: row for row in serial_rows}
                missing = [serial for serial in serial_numbers if serial not in serial_map]
                if missing:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial number not found: {missing[0]}")

                for serial in serial_numbers:
                    serial_row = serial_map[serial]
                    if serial_row.status != "in_transit":
                        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Serial number {serial} is not in transit")
                    serial_row.status = "in_stock"
                    serial_row.current_bin_id = item.to_bin_id
                    serial_row.last_movement_at = now

            item.received_quantity = quantity

            db.add(
                StockMovement(
                    movement_type="inter_warehouse_receive",
                    reference_type="inter_warehouse_transfer",
                    reference_number=transfer.transfer_number,
                    product_id=item.product_id,
                    from_bin_id=None,
                    to_bin_id=item.to_bin_id,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "inter_warehouse_transfer_id": transfer.id,
                        "inter_warehouse_transfer_item_id": item.id,
                        "batch_number": item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )

        transfer.status = "received"
        transfer.received_at = now
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="inter-warehouse transfer received")


@router.post("/{transfer_id}/cancel", response_model=MessageResponse)
async def cancel_inter_warehouse_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INTER_WAREHOUSE_TRANSFER_WRITE_PERMISSION)),
) -> MessageResponse:
    transfer = (
        await db.execute(select(InterWarehouseTransfer).where(InterWarehouseTransfer.id == transfer_id))
    ).scalar_one_or_none()
    if transfer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inter-warehouse transfer not found")
    if transfer.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer cannot be cancelled")

    transfer.status = "cancelled"
    transfer.cancelled_at = _now()
    await db.commit()
    return MessageResponse(message="inter-warehouse transfer cancelled")
