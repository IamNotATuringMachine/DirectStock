from datetime import UTC, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.catalog import Product
from app.models.inventory import Inventory, InventoryCountItem, InventoryCountSession, StockMovement
from app.models.warehouse import BinLocation, WarehouseZone
from app.schemas.inventory_counts import (
    InventoryCountGenerateItemsRequest,
    InventoryCountItemCountUpdate,
    InventoryCountItemResponse,
    InventoryCountSessionCreate,
    InventoryCountSessionResponse,
)
from app.schemas.user import MessageResponse
from app.utils.http_status import HTTP_422_UNPROCESSABLE
from .inventory_counts_workflow import (
    complete_inventory_count_session_flow,
    generate_inventory_count_items_flow,
)

router = APIRouter(prefix="/api/inventory-counts", tags=["inventory-counts"])

INVENTORY_COUNT_READ_PERMISSION = "module.inventory_counts.read"
INVENTORY_COUNT_WRITE_PERMISSION = "module.inventory_counts.write"
INVENTORY_COUNT_CANCEL_PERMISSION = "module.inventory_counts.cancel"


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


async def _get_session_or_404(db: AsyncSession, session_id: int) -> InventoryCountSession:
    session = (
        await db.execute(select(InventoryCountSession).where(InventoryCountSession.id == session_id))
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory count session not found")
    return session


async def _get_inventory_count_item_or_404(
    db: AsyncSession,
    *,
    session_id: int,
    item_id: int,
) -> InventoryCountItem:
    item = (
        await db.execute(
            select(InventoryCountItem).where(
                InventoryCountItem.id == item_id,
                InventoryCountItem.session_id == session_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory count item not found")
    return item


async def _to_item_response(db: AsyncSession, item: InventoryCountItem) -> InventoryCountItemResponse:
    item_row, product_number, product_name, bin_code = (
        await db.execute(
            select(
                InventoryCountItem,
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                BinLocation.code.label("bin_code"),
            )
            .join(Product, Product.id == InventoryCountItem.product_id)
            .join(BinLocation, BinLocation.id == InventoryCountItem.bin_location_id)
            .where(InventoryCountItem.id == item.id)
        )
    ).one()

    return InventoryCountItemResponse(
        id=item_row.id,
        session_id=item_row.session_id,
        inventory_id=item_row.inventory_id,
        product_id=item_row.product_id,
        product_number=product_number,
        product_name=product_name,
        bin_location_id=item_row.bin_location_id,
        bin_code=bin_code,
        snapshot_quantity=item_row.snapshot_quantity,
        counted_quantity=item_row.counted_quantity,
        difference_quantity=item_row.difference_quantity,
        unit=item_row.unit,
        count_attempts=item_row.count_attempts,
        recount_required=item_row.recount_required,
        last_counted_at=item_row.last_counted_at,
        counted_by=item_row.counted_by,
        created_at=item_row.created_at,
        updated_at=item_row.updated_at,
    )


def _to_session_response(item: InventoryCountSession) -> InventoryCountSessionResponse:
    return InventoryCountSessionResponse(
        id=item.id,
        session_number=item.session_number,
        session_type=item.session_type,
        status=item.status,
        warehouse_id=item.warehouse_id,
        tolerance_quantity=item.tolerance_quantity,
        generated_at=item.generated_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=list[InventoryCountSessionResponse])
async def list_inventory_count_sessions(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INVENTORY_COUNT_READ_PERMISSION)),
) -> list[InventoryCountSessionResponse]:
    stmt = select(InventoryCountSession).order_by(InventoryCountSession.id.desc())
    if status_filter:
        stmt = stmt.where(InventoryCountSession.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_session_response(row) for row in rows]


@router.post("", response_model=InventoryCountSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_count_session(
    payload: InventoryCountSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(INVENTORY_COUNT_WRITE_PERMISSION)),
) -> InventoryCountSessionResponse:
    session = InventoryCountSession(
        session_number=payload.session_number or _generate_number("INV"),
        session_type=payload.session_type,
        warehouse_id=payload.warehouse_id,
        tolerance_quantity=payload.tolerance_quantity,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(session)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inventory count session already exists") from exc
    await db.refresh(session)
    return _to_session_response(session)


@router.get("/{session_id}", response_model=InventoryCountSessionResponse)
async def get_inventory_count_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INVENTORY_COUNT_READ_PERMISSION)),
) -> InventoryCountSessionResponse:
    session = await _get_session_or_404(db, session_id)
    return _to_session_response(session)


@router.post("/{session_id}/generate-items", response_model=MessageResponse)
async def generate_inventory_count_items(
    session_id: int,
    payload: InventoryCountGenerateItemsRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INVENTORY_COUNT_WRITE_PERMISSION)),
) -> MessageResponse:
    session = await _get_session_or_404(db, session_id)
    count = await generate_inventory_count_items_flow(
        db=db,
        session=session,
        refresh_existing=payload.refresh_existing,
    )
    return MessageResponse(message=f"{count} inventory count items generated")


@router.get("/{session_id}/items", response_model=list[InventoryCountItemResponse])
async def list_inventory_count_items(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INVENTORY_COUNT_READ_PERMISSION)),
) -> list[InventoryCountItemResponse]:
    await _get_session_or_404(db, session_id)

    rows = (
        await db.execute(
            select(
                InventoryCountItem,
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                BinLocation.code.label("bin_code"),
            )
            .join(Product, Product.id == InventoryCountItem.product_id)
            .join(BinLocation, BinLocation.id == InventoryCountItem.bin_location_id)
            .where(InventoryCountItem.session_id == session_id)
            .order_by(BinLocation.code.asc(), Product.product_number.asc())
        )
    ).all()

    return [
        InventoryCountItemResponse(
            id=row[0].id,
            session_id=row[0].session_id,
            inventory_id=row[0].inventory_id,
            product_id=row[0].product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            bin_location_id=row[0].bin_location_id,
            bin_code=row.bin_code,
            snapshot_quantity=row[0].snapshot_quantity,
            counted_quantity=row[0].counted_quantity,
            difference_quantity=row[0].difference_quantity,
            unit=row[0].unit,
            count_attempts=row[0].count_attempts,
            recount_required=row[0].recount_required,
            last_counted_at=row[0].last_counted_at,
            counted_by=row[0].counted_by,
            created_at=row[0].created_at,
            updated_at=row[0].updated_at,
        )
        for row in rows
    ]


@router.put("/{session_id}/items/{item_id}", response_model=InventoryCountItemResponse)
async def count_inventory_item(
    session_id: int,
    item_id: int,
    payload: InventoryCountItemCountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(INVENTORY_COUNT_WRITE_PERMISSION)),
) -> InventoryCountItemResponse:
    session = await _get_session_or_404(db, session_id)
    if session.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inventory count session already completed")
    if session.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inventory count session is cancelled")

    item = await _get_inventory_count_item_or_404(db, session_id=session_id, item_id=item_id)
    now = _now()
    difference = payload.counted_quantity - Decimal(item.snapshot_quantity)

    item.counted_quantity = payload.counted_quantity
    item.difference_quantity = difference
    item.count_attempts = int(item.count_attempts) + 1
    item.recount_required = abs(difference) > Decimal(session.tolerance_quantity)
    item.last_counted_at = now
    item.counted_by = current_user.id

    if session.status == "draft":
        session.status = "in_progress"

    await db.commit()
    await db.refresh(item)
    return await _to_item_response(db, item)


@router.post("/{session_id}/complete", response_model=MessageResponse)
async def complete_inventory_count_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(INVENTORY_COUNT_WRITE_PERMISSION)),
) -> MessageResponse:
    session = await _get_session_or_404(db, session_id)
    await complete_inventory_count_session_flow(
        db=db,
        session=session,
        current_user_id=current_user.id,
    )

    return MessageResponse(message="inventory count session completed")


@router.post("/{session_id}/cancel", response_model=MessageResponse)
async def cancel_inventory_count_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INVENTORY_COUNT_CANCEL_PERMISSION)),
) -> MessageResponse:
    session = await _get_session_or_404(db, session_id)
    if session.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed session cannot be cancelled")
    session.status = "cancelled"
    await db.commit()
    return MessageResponse(message="inventory count session cancelled")


@router.get("/{session_id}/summary")
async def inventory_count_summary(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(INVENTORY_COUNT_READ_PERMISSION)),
) -> dict[str, int]:
    await _get_session_or_404(db, session_id)
    total = (
        await db.execute(
            select(func.count()).select_from(select(InventoryCountItem.id).where(InventoryCountItem.session_id == session_id).subquery())
        )
    ).scalar_one()
    counted = (
        await db.execute(
            select(func.count())
            .select_from(
                select(InventoryCountItem.id)
                .where(
                    InventoryCountItem.session_id == session_id,
                    InventoryCountItem.counted_quantity.is_not(None),
                )
                .subquery()
            )
        )
    ).scalar_one()
    recount_required = (
        await db.execute(
            select(func.count())
            .select_from(
                select(InventoryCountItem.id)
                .where(
                    InventoryCountItem.session_id == session_id,
                    InventoryCountItem.recount_required.is_(True),
                )
                .subquery()
            )
        )
    ).scalar_one()
    return {"total": total, "counted": counted, "recount_required": recount_required}
