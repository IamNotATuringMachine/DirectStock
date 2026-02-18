from datetime import UTC, date, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.dependencies import get_db, require_permissions, require_roles
from app.models.auth import User
from app.models.catalog import Customer, CustomerLocation, Product, ProductGroup
from app.models.inventory import (
    GoodsIssue,
    GoodsIssueItem,
    GoodsReceipt,
    GoodsReceiptItem,
    Inventory,
    InventoryBatch,
    SerialNumber,
    StockMovement,
    StockTransfer,
    StockTransferItem,
)
from app.models.phase3 import ReturnOrder, ReturnOrderItem
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.operations import (
    BinSuggestion,
    GoodsIssueCreate,
    GoodsIssueItemCreate,
    GoodsIssueItemResponse,
    GoodsIssueItemUpdate,
    GoodsIssueResponse,
    GoodsIssueUpdate,
    GoodsReceiptCreate,
    GoodsReceiptItemCreate,
    GoodsReceiptItemResponse,
    GoodsReceiptItemUpdate,
    GoodsReceiptResponse,
    GoodsReceiptUpdate,
    StockTransferCreate,
    StockTransferItemCreate,
    StockTransferItemResponse,
    StockTransferItemUpdate,
    StockTransferResponse,
    StockTransferUpdate,
)
from app.schemas.product import ProductAdHocCreate, ProductResponse
from app.schemas.user import MessageResponse
from app.services.alerts import evaluate_alerts
from app.utils.http_status import HTTP_422_UNPROCESSABLE
from app.utils.qr_generator import generate_item_labels_pdf, generate_serial_labels_pdf

router = APIRouter(prefix="/api", tags=["operations"])

GOODS_RECEIPT_READ_PERMISSION = "module.goods_receipts.read"
GOODS_RECEIPT_WRITE_PERMISSION = "module.goods_receipts.write"
GOODS_ISSUE_ROLES = ("admin", "lagerleiter", "lagermitarbeiter", "versand")
STOCK_TRANSFER_ROLES = ("admin", "lagerleiter", "lagermitarbeiter")


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


async def _resolve_customer_scope(
    db: AsyncSession,
    *,
    customer_id: int | None,
    customer_location_id: int | None,
) -> tuple[int | None, int | None]:
    if customer_location_id is None:
        if customer_id is None:
            return None, None
        customer = (await db.execute(select(Customer.id).where(Customer.id == customer_id))).scalar_one_or_none()
        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return customer_id, None

    location = (
        await db.execute(select(CustomerLocation).where(CustomerLocation.id == customer_location_id))
    ).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer location not found")

    resolved_customer_id = int(location.customer_id)
    if customer_id is not None and customer_id != resolved_customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer location does not belong to selected customer",
        )

    return resolved_customer_id, customer_location_id


async def _get_inventory(
    db: AsyncSession,
    *,
    product_id: int,
    bin_location_id: int,
    unit: str,
) -> Inventory:
    stmt = select(Inventory).where(
        Inventory.product_id == product_id,
        Inventory.bin_location_id == bin_location_id,
    )
    inventory = (await db.execute(stmt)).scalar_one_or_none()
    if inventory is None:
        inventory = Inventory(
            product_id=product_id,
            bin_location_id=bin_location_id,
            quantity=Decimal("0"),
            reserved_quantity=Decimal("0"),
            unit=unit,
        )
        db.add(inventory)
        await db.flush()
    return inventory


def _ensure_draft(entity_name: str, current_status: str) -> None:
    if current_status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{entity_name} is not in draft status",
        )


def _normalize_group_name(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_serial_numbers(values: list[str] | None) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        serial = raw.strip()
        if not serial:
            continue
        if serial in seen:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail=f"Duplicate serial number in payload: {serial}",
            )
        seen.add(serial)
        normalized.append(serial)
    return normalized


def _ensure_quantity_matches_serials(quantity: Decimal, serial_numbers: list[str], *, item_label: str) -> None:
    if not serial_numbers:
        return
    if quantity <= 0 or quantity != Decimal(len(serial_numbers)):
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail=f"{item_label} quantity must equal number of serial numbers",
        )


async def _get_inventory_batch(
    db: AsyncSession,
    *,
    product_id: int,
    bin_location_id: int,
    batch_number: str,
    unit: str,
    expiry_date: date | None,
    manufactured_at: date | None,
) -> InventoryBatch:
    batch = (
        await db.execute(
            select(InventoryBatch).where(
                InventoryBatch.product_id == product_id,
                InventoryBatch.bin_location_id == bin_location_id,
                InventoryBatch.batch_number == batch_number,
            )
        )
    ).scalar_one_or_none()

    if batch is None:
        batch = InventoryBatch(
            product_id=product_id,
            bin_location_id=bin_location_id,
            batch_number=batch_number,
            expiry_date=expiry_date,
            manufactured_at=manufactured_at,
            quantity=Decimal("0"),
            unit=unit,
        )
        db.add(batch)
        await db.flush()
        return batch

    if batch.expiry_date is None and expiry_date is not None:
        batch.expiry_date = expiry_date
    if batch.manufactured_at is None and manufactured_at is not None:
        batch.manufactured_at = manufactured_at
    if not batch.unit:
        batch.unit = unit

    return batch


async def _resolve_issue_batch(db: AsyncSession, *, issue_item: GoodsIssueItem) -> InventoryBatch | None:
    if issue_item.source_bin_id is None:
        return None
    if issue_item.batch_number:
        batch = (
            await db.execute(
                select(InventoryBatch).where(
                    InventoryBatch.product_id == issue_item.product_id,
                    InventoryBatch.bin_location_id == issue_item.source_bin_id,
                    InventoryBatch.batch_number == issue_item.batch_number,
                )
            )
        ).scalar_one_or_none()
        if batch is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Batch {issue_item.batch_number} not found for issue item {issue_item.id}",
            )
        return batch

    if issue_item.use_fefo:
        batch = (
            await db.execute(
                select(InventoryBatch)
                .where(
                    InventoryBatch.product_id == issue_item.product_id,
                    InventoryBatch.bin_location_id == issue_item.source_bin_id,
                    InventoryBatch.quantity > 0,
                )
                .order_by(
                    InventoryBatch.expiry_date.is_(None),
                    InventoryBatch.expiry_date.asc(),
                    InventoryBatch.id.asc(),
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if batch is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No FEFO batch available for issue item {issue_item.id}",
            )
        issue_item.batch_number = batch.batch_number
        return batch

    return None


async def _get_purchase_order_item_or_404(
    db: AsyncSession,
    *,
    purchase_order_item_id: int,
) -> PurchaseOrderItem:
    item = (
        await db.execute(
            select(PurchaseOrderItem).where(PurchaseOrderItem.id == purchase_order_item_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order item not found",
        )
    return item


async def _get_purchase_order_or_404(
    db: AsyncSession,
    *,
    purchase_order_id: int,
) -> PurchaseOrder:
    item = (
        await db.execute(
            select(PurchaseOrder).where(PurchaseOrder.id == purchase_order_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return item


def _ensure_purchase_order_ready_for_receipt(order: PurchaseOrder) -> None:
    if order.status not in {"ordered", "partially_received"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Purchase order {order.order_number} is not ready for goods receipt",
        )


def _resolve_receipt_mode(*, explicit_mode: str | None, purchase_order_id: int | None) -> str:
    if explicit_mode is not None:
        return explicit_mode
    return "po" if purchase_order_id is not None else "free"


def _resolve_receipt_source_type(*, explicit_source_type: str | None, mode: str) -> str:
    if explicit_source_type is not None:
        return explicit_source_type
    return "supplier"


def _is_condition_required_for_receipt(receipt: GoodsReceipt) -> bool:
    return receipt.mode == "free" and receipt.source_type in {"technician", "other"}


def _validate_receipt_mode_constraints(*, mode: str, purchase_order_id: int | None) -> None:
    if mode == "po" and purchase_order_id is None:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="purchase_order_id is required when mode is 'po'",
        )
    if mode == "free" and purchase_order_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="purchase_order_id is not allowed when mode is 'free'",
        )


async def _get_repair_center_bin_or_422(db: AsyncSession) -> BinLocation:
    repair_bin = (
        await db.execute(
            select(BinLocation)
            .join(WarehouseZone, BinLocation.zone_id == WarehouseZone.id)
            .where(
                WarehouseZone.zone_type == "returns",
                BinLocation.is_active == True,  # noqa: E712
            )
            .order_by(BinLocation.id.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if repair_bin is None:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="RepairCenter bin not configured (returns zone with active bin required)",
        )
    return repair_bin


async def _build_goods_receipt_item_response(
    db: AsyncSession,
    item: GoodsReceiptItem,
    *,
    product_cache: dict[int, Product] | None = None,
    bin_cache: dict[int, BinLocation] | None = None,
    purchase_order_item_cache: dict[int, PurchaseOrderItem] | None = None,
) -> GoodsReceiptItemResponse:
    p_cache = product_cache if product_cache is not None else {}
    b_cache = bin_cache if bin_cache is not None else {}
    poi_cache = purchase_order_item_cache if purchase_order_item_cache is not None else {}

    product = p_cache.get(item.product_id)
    if product is None:
        product = (
            await db.execute(select(Product).where(Product.id == item.product_id))
        ).scalar_one_or_none()
        if product is not None:
            p_cache[item.product_id] = product

    target_bin_code: str | None = None
    if item.target_bin_id is not None:
        target_bin = b_cache.get(item.target_bin_id)
        if target_bin is None:
            target_bin = (
                await db.execute(select(BinLocation).where(BinLocation.id == item.target_bin_id))
            ).scalar_one_or_none()
            if target_bin is not None:
                b_cache[item.target_bin_id] = target_bin
        target_bin_code = target_bin.code if target_bin else None

    expected_open_quantity: Decimal | None = None
    if item.purchase_order_item_id is not None:
        po_item = poi_cache.get(item.purchase_order_item_id)
        if po_item is None:
            po_item = (
                await db.execute(
                    select(PurchaseOrderItem).where(PurchaseOrderItem.id == item.purchase_order_item_id)
                )
            ).scalar_one_or_none()
            if po_item is not None:
                poi_cache[item.purchase_order_item_id] = po_item
        if po_item is not None:
            expected_open_quantity = max(
                Decimal(po_item.ordered_quantity) - Decimal(po_item.received_quantity),
                Decimal("0"),
            )

    return _to_goods_receipt_item_response(
        item,
        product_number=product.product_number if product else None,
        product_name=product.name if product else None,
        target_bin_code=target_bin_code,
        expected_open_quantity=expected_open_quantity,
    )


def _ensure_serial_tracked_quantity_is_integer(quantity: Decimal, *, item_label: str) -> None:
    if quantity <= 0:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail=f"{item_label} has invalid received quantity",
        )
    if quantity != quantity.to_integral_value():
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail=f"{item_label} requires integer quantity for tracked items",
        )


def _to_product_response(item: Product) -> ProductResponse:
    return ProductResponse(
        id=item.id,
        product_number=item.product_number,
        name=item.name,
        description=item.description,
        product_group_id=item.product_group_id,
        group_name=item.group.name if item.group else None,
        unit=item.unit,
        status=item.status,
        requires_item_tracking=item.requires_item_tracking,
        default_bin_id=item.default_bin_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_receipt_response(item: GoodsReceipt) -> GoodsReceiptResponse:
    return GoodsReceiptResponse(
        id=item.id,
        receipt_number=item.receipt_number,
        supplier_id=item.supplier_id,
        purchase_order_id=item.purchase_order_id,
        mode=item.mode,
        source_type=item.source_type,
        status=item.status,
        received_at=item.received_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_receipt_item_response(
    item: GoodsReceiptItem,
    *,
    product_number: str | None = None,
    product_name: str | None = None,
    target_bin_code: str | None = None,
    expected_open_quantity: Decimal | None = None,
) -> GoodsReceiptItemResponse:
    variance_quantity = (
        Decimal(item.received_quantity) - Decimal(item.expected_quantity)
        if item.expected_quantity is not None
        else None
    )
    return GoodsReceiptItemResponse(
        id=item.id,
        goods_receipt_id=item.goods_receipt_id,
        product_id=item.product_id,
        expected_quantity=item.expected_quantity,
        received_quantity=item.received_quantity,
        unit=item.unit,
        target_bin_id=item.target_bin_id,
        batch_number=item.batch_number,
        expiry_date=item.expiry_date,
        manufactured_at=item.manufactured_at,
        serial_numbers=item.serial_numbers,
        purchase_order_item_id=item.purchase_order_item_id,
        input_method=item.input_method,
        condition=item.condition,
        product_number=product_number,
        product_name=product_name,
        target_bin_code=target_bin_code,
        expected_open_quantity=expected_open_quantity,
        variance_quantity=variance_quantity,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_issue_response(item: GoodsIssue) -> GoodsIssueResponse:
    return GoodsIssueResponse(
        id=item.id,
        issue_number=item.issue_number,
        customer_id=item.customer_id,
        customer_location_id=item.customer_location_id,
        customer_reference=item.customer_reference,
        status=item.status,
        issued_at=item.issued_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_issue_item_response(item: GoodsIssueItem) -> GoodsIssueItemResponse:
    return GoodsIssueItemResponse(
        id=item.id,
        goods_issue_id=item.goods_issue_id,
        product_id=item.product_id,
        requested_quantity=item.requested_quantity,
        issued_quantity=item.issued_quantity,
        unit=item.unit,
        source_bin_id=item.source_bin_id,
        batch_number=item.batch_number,
        use_fefo=item.use_fefo,
        serial_numbers=item.serial_numbers,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_stock_transfer_response(item: StockTransfer) -> StockTransferResponse:
    return StockTransferResponse(
        id=item.id,
        transfer_number=item.transfer_number,
        status=item.status,
        transferred_at=item.transferred_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_stock_transfer_item_response(item: StockTransferItem) -> StockTransferItemResponse:
    return StockTransferItemResponse(
        id=item.id,
        stock_transfer_id=item.stock_transfer_id,
        product_id=item.product_id,
        quantity=item.quantity,
        unit=item.unit,
        from_bin_id=item.from_bin_id,
        to_bin_id=item.to_bin_id,
        batch_number=item.batch_number,
        serial_numbers=item.serial_numbers,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/goods-receipts", response_model=list[GoodsReceiptResponse])
async def list_goods_receipts(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> list[GoodsReceiptResponse]:
    stmt = select(GoodsReceipt).order_by(GoodsReceipt.id.desc())
    if status_filter:
        stmt = stmt.where(GoodsReceipt.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_goods_receipt_response(item) for item in rows]


@router.post("/goods-receipts", response_model=GoodsReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_goods_receipt(
    payload: GoodsReceiptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptResponse:
    mode = _resolve_receipt_mode(
        explicit_mode=payload.mode,
        purchase_order_id=payload.purchase_order_id,
    )
    source_type = _resolve_receipt_source_type(
        explicit_source_type=payload.source_type,
        mode=mode,
    )
    _validate_receipt_mode_constraints(mode=mode, purchase_order_id=payload.purchase_order_id)

    purchase_order: PurchaseOrder | None = None
    if payload.purchase_order_id is not None:
        purchase_order = await _get_purchase_order_or_404(
            db,
            purchase_order_id=payload.purchase_order_id,
        )
        _ensure_purchase_order_ready_for_receipt(purchase_order)
        if payload.supplier_id is not None and purchase_order.supplier_id != payload.supplier_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Supplier does not match linked purchase order",
            )

    item = GoodsReceipt(
        receipt_number=payload.receipt_number or _generate_number("WE"),
        supplier_id=payload.supplier_id if payload.supplier_id is not None else purchase_order.supplier_id if purchase_order else None,
        purchase_order_id=payload.purchase_order_id,
        mode=mode,
        source_type=source_type,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Goods receipt already exists") from exc

    await db.refresh(item)
    return _to_goods_receipt_response(item)


@router.get("/products/{product_id}/bin-suggestions", response_model=list[BinSuggestion])
async def get_product_bin_suggestions(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> list[BinSuggestion]:
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    suggestions: list[BinSuggestion] = []
    seen_bin_ids: set[int] = set()

    if product.default_bin_id is not None:
        row = (
            await db.execute(
                select(BinLocation, WarehouseZone, Warehouse)
                .join(WarehouseZone, BinLocation.zone_id == WarehouseZone.id)
                .join(Warehouse, WarehouseZone.warehouse_id == Warehouse.id)
                .where(BinLocation.id == product.default_bin_id)
            )
        ).one_or_none()
        if row is not None:
            bin_loc, zone, warehouse = row
            inv = (
                await db.execute(
                    select(Inventory).where(
                        Inventory.product_id == product_id,
                        Inventory.bin_location_id == bin_loc.id,
                    )
                )
            ).scalar_one_or_none()
            suggestions.append(
                BinSuggestion(
                    bin_id=bin_loc.id,
                    bin_code=bin_loc.code,
                    zone_id=zone.id,
                    zone_code=zone.code,
                    warehouse_id=warehouse.id,
                    warehouse_code=warehouse.code,
                    priority="default",
                    current_quantity=Decimal(inv.quantity) if inv else Decimal("0"),
                )
            )
            seen_bin_ids.add(bin_loc.id)

    existing_rows = list(
        (
            await db.execute(
                select(Inventory, BinLocation, WarehouseZone, Warehouse)
                .join(BinLocation, Inventory.bin_location_id == BinLocation.id)
                .join(WarehouseZone, BinLocation.zone_id == WarehouseZone.id)
                .join(Warehouse, WarehouseZone.warehouse_id == Warehouse.id)
                .where(
                    Inventory.product_id == product_id,
                    Inventory.quantity > 0,
                )
                .order_by(Inventory.quantity.desc())
                .limit(5)
            )
        ).all()
    )
    for inv, bin_loc, zone, warehouse in existing_rows:
        if bin_loc.id in seen_bin_ids:
            continue
        suggestions.append(
            BinSuggestion(
                bin_id=bin_loc.id,
                bin_code=bin_loc.code,
                zone_id=zone.id,
                zone_code=zone.code,
                warehouse_id=warehouse.id,
                warehouse_code=warehouse.code,
                priority="existing",
                current_quantity=Decimal(inv.quantity),
            )
        )
        seen_bin_ids.add(bin_loc.id)

    return suggestions


@router.post(
    "/goods-receipts/from-po/{po_id}",
    response_model=GoodsReceiptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_receipt_from_po(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptResponse:
    purchase_order = (
        await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    ).scalar_one_or_none()
    if purchase_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    _ensure_purchase_order_ready_for_receipt(purchase_order)

    existing_receipt = (
        await db.execute(
            select(GoodsReceipt).where(
                GoodsReceipt.purchase_order_id == po_id,
                GoodsReceipt.status == "draft",
            )
        )
    ).scalar_one_or_none()
    if existing_receipt is not None:
        return _to_goods_receipt_response(existing_receipt)

    receipt = GoodsReceipt(
        receipt_number=_generate_number("WE"),
        purchase_order_id=po_id,
        supplier_id=purchase_order.supplier_id,
        mode="po",
        source_type="supplier",
        created_by=current_user.id,
    )
    db.add(receipt)
    await db.flush()

    po_items = list(
        (
            await db.execute(
                select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == po_id)
            )
        ).scalars()
    )
    for po_item in po_items:
        remaining = Decimal(po_item.ordered_quantity) - Decimal(po_item.received_quantity)
        if remaining > 0:
            db.add(
                GoodsReceiptItem(
                    goods_receipt_id=receipt.id,
                    product_id=po_item.product_id,
                    expected_quantity=remaining,
                    received_quantity=Decimal("0"),
                    unit=po_item.unit,
                    purchase_order_item_id=po_item.id,
                    input_method="manual",
                    condition="new",
                )
            )

    await db.commit()
    await db.refresh(receipt)
    return _to_goods_receipt_response(receipt)


@router.get("/goods-receipts/{receipt_id}", response_model=GoodsReceiptResponse)
async def get_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> GoodsReceiptResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")
    return _to_goods_receipt_response(item)


@router.put("/goods-receipts/{receipt_id}", response_model=GoodsReceiptResponse)
async def update_goods_receipt(
    receipt_id: int,
    payload: GoodsReceiptUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    updates = payload.model_dump(exclude_unset=True)
    purchase_order_id = updates.get("purchase_order_id", item.purchase_order_id)
    mode = updates.get("mode", item.mode)
    source_type = updates.get("source_type", item.source_type)
    _validate_receipt_mode_constraints(mode=mode, purchase_order_id=purchase_order_id)

    if "mode" in updates and "source_type" not in updates:
        updates["source_type"] = _resolve_receipt_source_type(
            explicit_source_type=None,
            mode=mode,
        )
    elif source_type is not None:
        updates["source_type"] = source_type

    supplier_id = updates.get("supplier_id", item.supplier_id)
    if purchase_order_id is not None:
        purchase_order = await _get_purchase_order_or_404(
            db,
            purchase_order_id=purchase_order_id,
        )
        _ensure_purchase_order_ready_for_receipt(purchase_order)
        if supplier_id is not None and purchase_order.supplier_id != supplier_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Supplier does not match linked purchase order",
            )

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_receipt_response(item)


@router.delete("/goods-receipts/{receipt_id}", response_model=MessageResponse)
async def delete_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="goods receipt deleted")


@router.get("/goods-receipts/{receipt_id}/items", response_model=list[GoodsReceiptItemResponse])
async def list_goods_receipt_items(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> list[GoodsReceiptItemResponse]:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    rows = list(
        (
            await db.execute(
                select(GoodsReceiptItem)
                .where(GoodsReceiptItem.goods_receipt_id == receipt_id)
                .order_by(GoodsReceiptItem.id.asc())
            )
        ).scalars()
    )
    product_cache: dict[int, Product] = {}
    bin_cache: dict[int, BinLocation] = {}
    purchase_order_item_cache: dict[int, PurchaseOrderItem] = {}
    return [
        await _build_goods_receipt_item_response(
            db,
            item,
            product_cache=product_cache,
            bin_cache=bin_cache,
            purchase_order_item_cache=purchase_order_item_cache,
        )
        for item in rows
    ]


@router.post(
    "/goods-receipts/{receipt_id}/items",
    response_model=GoodsReceiptItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_receipt_item(
    receipt_id: int,
    payload: GoodsReceiptItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptItemResponse:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", parent.status)

    values = payload.model_dump()
    input_method = values.get("input_method") or "manual"
    values["input_method"] = input_method

    condition = values.get("condition")
    if _is_condition_required_for_receipt(parent):
        if condition is None:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail="condition is required when goods receipt mode is 'free'",
            )
    else:
        values["condition"] = condition or "new"
    if values.get("condition") is None:
        values["condition"] = "new"

    serial_numbers = _normalize_serial_numbers(values.get("serial_numbers"))
    values["serial_numbers"] = serial_numbers or None

    if (values.get("expiry_date") or values.get("manufactured_at")) and not values.get("batch_number"):
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="batch_number is required when expiry_date or manufactured_at is set",
        )

    purchase_order_item_id = values.get("purchase_order_item_id")
    if purchase_order_item_id is not None:
        purchase_order_item = await _get_purchase_order_item_or_404(
            db,
            purchase_order_item_id=purchase_order_item_id,
        )
        if purchase_order_item.product_id != values["product_id"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase order item does not match goods receipt item product",
            )
        if parent.purchase_order_id is not None and purchase_order_item.purchase_order_id != parent.purchase_order_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase order item does not belong to linked purchase order",
            )
    elif parent.purchase_order_id is not None:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="purchase_order_item_id is required when goods receipt is linked to a purchase order",
        )

    item = GoodsReceiptItem(goods_receipt_id=receipt_id, **values)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while creating receipt item") from exc

    await db.refresh(item)
    return await _build_goods_receipt_item_response(db, item)


@router.put(
    "/goods-receipts/{receipt_id}/items/{item_id}",
    response_model=GoodsReceiptItemResponse,
)
async def update_goods_receipt_item(
    receipt_id: int,
    item_id: int,
    payload: GoodsReceiptItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> GoodsReceiptItemResponse:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", parent.status)

    item = (
        await db.execute(
            select(GoodsReceiptItem).where(
                GoodsReceiptItem.id == item_id,
                GoodsReceiptItem.goods_receipt_id == receipt_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt item not found")

    updates = payload.model_dump(exclude_unset=True)
    if updates.get("use_fefo") is None:
        updates.pop("use_fefo", None)
    if "input_method" in updates and updates["input_method"] is None:
        updates.pop("input_method", None)
    if "serial_numbers" in updates:
        serial_numbers = _normalize_serial_numbers(updates.get("serial_numbers"))
        updates["serial_numbers"] = serial_numbers or None
    if "condition" in updates and updates["condition"] is None:
        if _is_condition_required_for_receipt(parent):
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail="condition is required when goods receipt mode is 'free'",
            )
        updates["condition"] = "new"
    if _is_condition_required_for_receipt(parent):
        candidate_condition = updates.get("condition", item.condition)
        if candidate_condition is None:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail="condition is required when goods receipt mode is 'free'",
            )
    candidate_batch_number = updates.get("batch_number", item.batch_number)
    candidate_expiry = updates.get("expiry_date", item.expiry_date)
    candidate_manufactured = updates.get("manufactured_at", item.manufactured_at)
    if (candidate_expiry or candidate_manufactured) and not candidate_batch_number:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="batch_number is required when expiry_date or manufactured_at is set",
        )

    if "purchase_order_item_id" in updates and updates["purchase_order_item_id"] is not None:
        purchase_order_item = await _get_purchase_order_item_or_404(
            db,
            purchase_order_item_id=updates["purchase_order_item_id"],
        )
        if purchase_order_item.product_id != item.product_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase order item does not match goods receipt item product",
            )
        if parent.purchase_order_id is not None and purchase_order_item.purchase_order_id != parent.purchase_order_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Purchase order item does not belong to linked purchase order",
            )
    if parent.purchase_order_id is not None:
        candidate_purchase_order_item_id = updates.get("purchase_order_item_id", item.purchase_order_item_id)
        if candidate_purchase_order_item_id is None:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail="purchase_order_item_id is required when goods receipt is linked to a purchase order",
            )

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return await _build_goods_receipt_item_response(db, item)


@router.delete("/goods-receipts/{receipt_id}/items/{item_id}", response_model=MessageResponse)
async def delete_goods_receipt_item(
    receipt_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> MessageResponse:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", parent.status)

    item = (
        await db.execute(
            select(GoodsReceiptItem).where(
                GoodsReceiptItem.id == item_id,
                GoodsReceiptItem.goods_receipt_id == receipt_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt item not found")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="goods receipt item deleted")


@router.post(
    "/goods-receipts/{receipt_id}/ad-hoc-product",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_receipt_adhoc_product(
    receipt_id: int,
    payload: ProductAdHocCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permissions("module.products.quick_create", GOODS_RECEIPT_WRITE_PERMISSION)),
) -> ProductResponse:
    receipt = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")
    _ensure_draft("Goods receipt", receipt.status)

    group_name = _normalize_group_name(payload.product_group_name)
    if payload.product_group_id is not None and group_name is not None:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Provide either product_group_id or product_group_name, not both",
        )

    group_id = payload.product_group_id
    if group_name is not None:
        group = (await db.execute(select(ProductGroup).where(ProductGroup.name == group_name))).scalar_one_or_none()
        if group is None:
            group = ProductGroup(name=group_name, description=None, is_active=True)
            db.add(group)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                group = (await db.execute(select(ProductGroup).where(ProductGroup.name == group_name))).scalar_one_or_none()
                if group is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Conflict while creating product group",
                    )
        group_id = group.id

    product_payload = payload.model_dump(exclude={"product_group_name"})
    product_payload["product_group_id"] = group_id
    product = Product(**product_payload)
    db.add(product)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product already exists") from exc

    product = (
        await db.execute(
            select(Product).where(Product.id == product.id).options(joinedload(Product.group))
        )
    ).scalar_one()
    return _to_product_response(product)


@router.get("/goods-receipts/{receipt_id}/items/{item_id}/serial-labels/pdf")
async def get_goods_receipt_item_serial_labels_pdf(
    receipt_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> Response:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    receipt_item = (
        await db.execute(
            select(GoodsReceiptItem).where(
                GoodsReceiptItem.id == item_id,
                GoodsReceiptItem.goods_receipt_id == receipt_id,
            )
        )
    ).scalar_one_or_none()
    if receipt_item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt item not found")

    serial_numbers = _normalize_serial_numbers(receipt_item.serial_numbers)
    if not serial_numbers:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Goods receipt item has no serial numbers",
        )

    product = (
        await db.execute(
            select(Product).where(Product.id == receipt_item.product_id)
        )
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    labels = [
        (
            product.name,
            serial_number,
            product.product_number,
            f"DS:SN:{serial_number}",
        )
        for serial_number in serial_numbers
    ]
    pdf_bytes = generate_serial_labels_pdf(labels)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="we-{receipt_id}-item-{item_id}-serial-labels.pdf"'},
    )


@router.get("/goods-receipts/{receipt_id}/items/{item_id}/item-labels/pdf")
async def get_goods_receipt_item_labels_pdf(
    receipt_id: int,
    item_id: int,
    copies: int = Query(default=1, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> Response:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    receipt_item = (
        await db.execute(
            select(GoodsReceiptItem).where(
                GoodsReceiptItem.id == item_id,
                GoodsReceiptItem.goods_receipt_id == receipt_id,
            )
        )
    ).scalar_one_or_none()
    if receipt_item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt item not found")

    product = (
        await db.execute(
            select(Product).where(Product.id == receipt_item.product_id)
        )
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    labels: list[tuple[str, str, str]] = []
    for index in range(1, copies + 1):
        qr_payload = f"DS:ART:{product.product_number}"
        labels.append((product.name, product.product_number, f"{qr_payload}:C{index:03d}"))

    pdf_bytes = generate_item_labels_pdf(labels)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="we-{receipt_id}-item-{item_id}-labels.pdf"'},
    )


@router.post("/goods-receipts/{receipt_id}/complete", response_model=MessageResponse)
async def complete_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    receipt_items = list(
        (
            await db.execute(select(GoodsReceiptItem).where(GoodsReceiptItem.goods_receipt_id == receipt_id))
        ).scalars()
    )
    if not receipt_items:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Goods receipt has no items",
        )

    now = _now()
    touched_product_ids: set[int] = set()
    touched_purchase_order_ids: set[int] = set()
    purchase_order_item_cache: dict[int, PurchaseOrderItem] = {}
    purchase_order_cache: dict[int, PurchaseOrder] = {}
    product_cache: dict[int, Product] = {}
    linked_purchase_order: PurchaseOrder | None = None
    if item.purchase_order_id is not None:
        linked_purchase_order = await _get_purchase_order_or_404(
            db,
            purchase_order_id=item.purchase_order_id,
        )
        _ensure_purchase_order_ready_for_receipt(linked_purchase_order)
    non_new_items = [ri for ri in receipt_items if (ri.condition or "new") != "new"]
    repair_bin: BinLocation | None = None
    if non_new_items:
        repair_bin = await _get_repair_center_bin_or_422(db)

    try:
        for receipt_item in receipt_items:
            effective_target_bin_id = receipt_item.target_bin_id
            if (receipt_item.condition or "new") != "new":
                effective_target_bin_id = repair_bin.id if repair_bin else None

            if effective_target_bin_id is None:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Receipt item {receipt_item.id} has no effective target bin",
                )

            quantity = Decimal(receipt_item.received_quantity)
            if quantity <= 0:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Receipt item {receipt_item.id} has invalid received quantity",
                )

            serial_numbers = _normalize_serial_numbers(receipt_item.serial_numbers)
            product = product_cache.get(receipt_item.product_id)
            if product is None:
                product = (
                    await db.execute(
                        select(Product).where(Product.id == receipt_item.product_id)
                    )
                ).scalar_one_or_none()
                if product is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
                product_cache[receipt_item.product_id] = product

            if product.requires_item_tracking:
                if not serial_numbers:
                    raise HTTPException(
                        status_code=HTTP_422_UNPROCESSABLE,
                        detail=f"Receipt item {receipt_item.id} requires serial numbers for tracked product",
                    )
                _ensure_serial_tracked_quantity_is_integer(
                    quantity,
                    item_label=f"Receipt item {receipt_item.id}",
                )
            _ensure_quantity_matches_serials(quantity, serial_numbers, item_label=f"Receipt item {receipt_item.id}")

            purchase_order_item: PurchaseOrderItem | None = None
            if receipt_item.purchase_order_item_id is not None:
                purchase_order_item = purchase_order_item_cache.get(receipt_item.purchase_order_item_id)
                if purchase_order_item is None:
                    purchase_order_item = await _get_purchase_order_item_or_404(
                        db,
                        purchase_order_item_id=receipt_item.purchase_order_item_id,
                    )
                    purchase_order_item_cache[receipt_item.purchase_order_item_id] = purchase_order_item

                if purchase_order_item.product_id != receipt_item.product_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Receipt item {receipt_item.id} references a purchase order item with different product",
                    )
                if linked_purchase_order is not None and purchase_order_item.purchase_order_id != linked_purchase_order.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Receipt item {receipt_item.id} does not belong to linked purchase order",
                    )

                purchase_order = purchase_order_cache.get(purchase_order_item.purchase_order_id)
                if purchase_order is None:
                    purchase_order = (
                        await db.execute(
                            select(PurchaseOrder).where(PurchaseOrder.id == purchase_order_item.purchase_order_id)
                        )
                    ).scalar_one_or_none()
                    if purchase_order is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Purchase order not found",
                        )
                    purchase_order_cache[purchase_order.id] = purchase_order

                _ensure_purchase_order_ready_for_receipt(purchase_order)

                next_received = Decimal(purchase_order_item.received_quantity) + quantity
                if next_received > Decimal(purchase_order_item.ordered_quantity):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Goods receipt quantity exceeds open quantity for purchase order item {purchase_order_item.id}",
                    )
                purchase_order_item.received_quantity = next_received
                touched_purchase_order_ids.add(purchase_order.id)
            elif linked_purchase_order is not None:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Receipt item {receipt_item.id} requires purchase_order_item_id for linked purchase order",
                )

            inventory = await _get_inventory(
                db,
                product_id=receipt_item.product_id,
                bin_location_id=effective_target_bin_id,
                unit=receipt_item.unit,
            )
            inventory.quantity = Decimal(inventory.quantity) + quantity

            batch: InventoryBatch | None = None
            if receipt_item.batch_number:
                batch = await _get_inventory_batch(
                    db,
                    product_id=receipt_item.product_id,
                    bin_location_id=effective_target_bin_id,
                    batch_number=receipt_item.batch_number,
                    unit=receipt_item.unit,
                    expiry_date=receipt_item.expiry_date,
                    manufactured_at=receipt_item.manufactured_at,
                )
                batch.quantity = Decimal(batch.quantity) + quantity
            elif receipt_item.expiry_date or receipt_item.manufactured_at:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Receipt item {receipt_item.id} requires batch_number for date tracking",
                )

            if serial_numbers:
                existing_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber.serial_number).where(SerialNumber.serial_number.in_(serial_numbers))
                        )
                    ).scalars()
                )
                if existing_rows:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Serial number already exists: {existing_rows[0]}",
                    )
                for serial_number in serial_numbers:
                    db.add(
                        SerialNumber(
                            product_id=receipt_item.product_id,
                            serial_number=serial_number,
                            batch_id=batch.id if batch else None,
                            current_bin_id=effective_target_bin_id,
                            status="in_stock",
                            last_movement_at=now,
                        )
                    )

            db.add(
                StockMovement(
                    movement_type="goods_receipt",
                    reference_type="goods_receipt",
                    reference_number=item.receipt_number,
                    product_id=receipt_item.product_id,
                    from_bin_id=None,
                    to_bin_id=effective_target_bin_id,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "goods_receipt_id": item.id,
                        "goods_receipt_item_id": receipt_item.id,
                        "purchase_order_item_id": receipt_item.purchase_order_item_id,
                        "batch_number": receipt_item.batch_number,
                        "serial_numbers": serial_numbers or None,
                        "condition": receipt_item.condition,
                        "original_target_bin_id": receipt_item.target_bin_id,
                    },
                )
            )
            touched_product_ids.add(receipt_item.product_id)

        await db.flush()
        for purchase_order_id in touched_purchase_order_ids:
            purchase_order = purchase_order_cache[purchase_order_id]
            order_items = list(
                (
                    await db.execute(
                        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == purchase_order_id)
                    )
                ).scalars()
            )
            all_received = bool(order_items) and all(
                Decimal(order_item.received_quantity) >= Decimal(order_item.ordered_quantity)
                for order_item in order_items
            )
            any_received = any(Decimal(order_item.received_quantity) > 0 for order_item in order_items)
            if all_received:
                purchase_order.status = "completed"
                purchase_order.completed_at = now
            elif any_received:
                purchase_order.status = "partially_received"
                purchase_order.completed_at = None

        item.status = "completed"
        item.completed_at = now
        if item.received_at is None:
            item.received_at = now

        if non_new_items:
            return_order = ReturnOrder(
                return_number=_generate_number("RT"),
                source_type="technician",
                source_reference=item.receipt_number,
                status="registered",
                registered_at=now,
                created_by=current_user.id,
            )
            db.add(return_order)
            await db.flush()

            for ri in non_new_items:
                db.add(
                    ReturnOrderItem(
                        return_order_id=return_order.id,
                        product_id=ri.product_id,
                        quantity=ri.received_quantity,
                        unit=ri.unit,
                        decision="repair",
                        reason=f"Zustand bei Wareneingang: {ri.condition}",
                        target_bin_id=repair_bin.id if repair_bin else None,
                    )
                )

        await evaluate_alerts(
            db,
            trigger="goods_receipt_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="goods receipt completed")


@router.post("/goods-receipts/{receipt_id}/cancel", response_model=MessageResponse)
async def cancel_goods_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_WRITE_PERMISSION)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    _ensure_draft("Goods receipt", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="goods receipt cancelled")


@router.get("/goods-issues", response_model=list[GoodsIssueResponse])
async def list_goods_issues(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> list[GoodsIssueResponse]:
    stmt = select(GoodsIssue).order_by(GoodsIssue.id.desc())
    if status_filter:
        stmt = stmt.where(GoodsIssue.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_goods_issue_response(item) for item in rows]


@router.post("/goods-issues", response_model=GoodsIssueResponse, status_code=status.HTTP_201_CREATED)
async def create_goods_issue(
    payload: GoodsIssueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> GoodsIssueResponse:
    customer_id, customer_location_id = await _resolve_customer_scope(
        db,
        customer_id=payload.customer_id,
        customer_location_id=payload.customer_location_id,
    )

    item = GoodsIssue(
        issue_number=payload.issue_number or _generate_number("WA"),
        customer_id=customer_id,
        customer_location_id=customer_location_id,
        customer_reference=payload.customer_reference,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Goods issue already exists") from exc

    await db.refresh(item)
    return _to_goods_issue_response(item)


@router.get("/goods-issues/{issue_id}", response_model=GoodsIssueResponse)
async def get_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> GoodsIssueResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")
    return _to_goods_issue_response(item)


@router.put("/goods-issues/{issue_id}", response_model=GoodsIssueResponse)
async def update_goods_issue(
    issue_id: int,
    payload: GoodsIssueUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> GoodsIssueResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    updates = payload.model_dump(exclude_unset=True)
    if "customer_id" in updates or "customer_location_id" in updates:
        requested_customer_id = updates.get("customer_id", item.customer_id)
        requested_location_id = updates.get("customer_location_id", item.customer_location_id)
        if "customer_id" in updates and updates["customer_id"] is None and "customer_location_id" not in updates:
            requested_location_id = None
        resolved_customer_id, resolved_location_id = await _resolve_customer_scope(
            db,
            customer_id=requested_customer_id,
            customer_location_id=requested_location_id,
        )
        updates["customer_id"] = resolved_customer_id
        updates["customer_location_id"] = resolved_location_id

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_issue_response(item)


@router.delete("/goods-issues/{issue_id}", response_model=MessageResponse)
async def delete_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="goods issue deleted")


@router.get("/goods-issues/{issue_id}/items", response_model=list[GoodsIssueItemResponse])
async def list_goods_issue_items(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> list[GoodsIssueItemResponse]:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    rows = list(
        (
            await db.execute(
                select(GoodsIssueItem).where(GoodsIssueItem.goods_issue_id == issue_id).order_by(GoodsIssueItem.id.asc())
            )
        ).scalars()
    )
    return [_to_goods_issue_item_response(item) for item in rows]


@router.post(
    "/goods-issues/{issue_id}/items",
    response_model=GoodsIssueItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_goods_issue_item(
    issue_id: int,
    payload: GoodsIssueItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> GoodsIssueItemResponse:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", parent.status)

    values = payload.model_dump()
    serial_numbers = _normalize_serial_numbers(values.get("serial_numbers"))
    values["serial_numbers"] = serial_numbers or None
    item = GoodsIssueItem(goods_issue_id=issue_id, **values)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while creating issue item") from exc

    await db.refresh(item)
    return _to_goods_issue_item_response(item)


@router.put(
    "/goods-issues/{issue_id}/items/{item_id}",
    response_model=GoodsIssueItemResponse,
)
async def update_goods_issue_item(
    issue_id: int,
    item_id: int,
    payload: GoodsIssueItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> GoodsIssueItemResponse:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", parent.status)

    item = (
        await db.execute(
            select(GoodsIssueItem).where(
                GoodsIssueItem.id == item_id,
                GoodsIssueItem.goods_issue_id == issue_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue item not found")

    updates = payload.model_dump(exclude_unset=True)
    if "serial_numbers" in updates:
        serial_numbers = _normalize_serial_numbers(updates.get("serial_numbers"))
        updates["serial_numbers"] = serial_numbers or None

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_goods_issue_item_response(item)


@router.delete("/goods-issues/{issue_id}/items/{item_id}", response_model=MessageResponse)
async def delete_goods_issue_item(
    issue_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> MessageResponse:
    parent = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", parent.status)

    item = (
        await db.execute(
            select(GoodsIssueItem).where(
                GoodsIssueItem.id == item_id,
                GoodsIssueItem.goods_issue_id == issue_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue item not found")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="goods issue item deleted")


@router.post("/goods-issues/{issue_id}/complete", response_model=MessageResponse)
async def complete_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    issue_items = list(
        (
            await db.execute(select(GoodsIssueItem).where(GoodsIssueItem.goods_issue_id == issue_id))
        ).scalars()
    )
    if not issue_items:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Goods issue has no items",
        )

    now = _now()
    touched_product_ids: set[int] = set()

    try:
        for issue_item in issue_items:
            if issue_item.source_bin_id is None:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Issue item {issue_item.id} has no source_bin_id",
                )

            quantity = Decimal(issue_item.issued_quantity or 0)
            if quantity <= 0:
                quantity = Decimal(issue_item.requested_quantity)

            serial_numbers = _normalize_serial_numbers(issue_item.serial_numbers)
            _ensure_quantity_matches_serials(quantity, serial_numbers, item_label=f"Issue item {issue_item.id}")

            inventory = (
                await db.execute(
                    select(Inventory).where(
                        Inventory.product_id == issue_item.product_id,
                        Inventory.bin_location_id == issue_item.source_bin_id,
                    )
                )
            ).scalar_one_or_none()

            if inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for product {issue_item.product_id} at bin {issue_item.source_bin_id}",
                )

            available_quantity = Decimal(inventory.quantity) - Decimal(inventory.reserved_quantity)
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient stock for product {issue_item.product_id} at bin {issue_item.source_bin_id} "
                        f"(available={available_quantity}, requested={quantity})"
                    ),
                )

            inventory.quantity = Decimal(inventory.quantity) - quantity
            issue_item.issued_quantity = quantity

            batch = await _resolve_issue_batch(db, issue_item=issue_item)
            if batch is not None:
                if Decimal(batch.quantity) < quantity:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Insufficient batch stock for issue item {issue_item.id} (batch={batch.batch_number})",
                    )
                batch.quantity = Decimal(batch.quantity) - quantity

            if serial_numbers:
                serial_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber).where(
                                SerialNumber.serial_number.in_(serial_numbers),
                                SerialNumber.product_id == issue_item.product_id,
                            )
                        )
                    ).scalars()
                )
                serial_map = {row.serial_number: row for row in serial_rows}
                missing = [serial for serial in serial_numbers if serial not in serial_map]
                if missing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Serial number not found: {missing[0]}",
                    )

                for serial in serial_numbers:
                    serial_row = serial_map[serial]
                    if serial_row.status != "in_stock" or serial_row.current_bin_id != issue_item.source_bin_id:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Serial number {serial} is not available in source bin",
                        )
                    serial_row.status = "issued"
                    serial_row.current_bin_id = None
                    serial_row.last_movement_at = now

            db.add(
                StockMovement(
                    movement_type="goods_issue",
                    reference_type="goods_issue",
                    reference_number=item.issue_number,
                    product_id=issue_item.product_id,
                    from_bin_id=issue_item.source_bin_id,
                    to_bin_id=None,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "goods_issue_id": item.id,
                        "goods_issue_item_id": issue_item.id,
                        "batch_number": issue_item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )
            touched_product_ids.add(issue_item.product_id)

        item.status = "completed"
        item.completed_at = now
        if item.issued_at is None:
            item.issued_at = now

        await evaluate_alerts(
            db,
            trigger="goods_issue_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="goods issue completed")


@router.post("/goods-issues/{issue_id}/cancel", response_model=MessageResponse)
async def cancel_goods_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*GOODS_ISSUE_ROLES)),
) -> MessageResponse:
    item = (await db.execute(select(GoodsIssue).where(GoodsIssue.id == issue_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods issue not found")

    _ensure_draft("Goods issue", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="goods issue cancelled")


@router.get("/stock-transfers", response_model=list[StockTransferResponse])
async def list_stock_transfers(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> list[StockTransferResponse]:
    stmt = select(StockTransfer).order_by(StockTransfer.id.desc())
    if status_filter:
        stmt = stmt.where(StockTransfer.status == status_filter)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_stock_transfer_response(item) for item in rows]


@router.post("/stock-transfers", response_model=StockTransferResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_transfer(
    payload: StockTransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> StockTransferResponse:
    item = StockTransfer(
        transfer_number=payload.transfer_number or _generate_number("ST"),
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stock transfer already exists") from exc

    await db.refresh(item)
    return _to_stock_transfer_response(item)


@router.get("/stock-transfers/{transfer_id}", response_model=StockTransferResponse)
async def get_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> StockTransferResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")
    return _to_stock_transfer_response(item)


@router.put("/stock-transfers/{transfer_id}", response_model=StockTransferResponse)
async def update_stock_transfer(
    transfer_id: int,
    payload: StockTransferUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> StockTransferResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_stock_transfer_response(item)


@router.delete("/stock-transfers/{transfer_id}", response_model=MessageResponse)
async def delete_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> MessageResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="stock transfer deleted")


@router.get("/stock-transfers/{transfer_id}/items", response_model=list[StockTransferItemResponse])
async def list_stock_transfer_items(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> list[StockTransferItemResponse]:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    rows = list(
        (
            await db.execute(
                select(StockTransferItem)
                .where(StockTransferItem.stock_transfer_id == transfer_id)
                .order_by(StockTransferItem.id.asc())
            )
        ).scalars()
    )
    return [_to_stock_transfer_item_response(item) for item in rows]


@router.post(
    "/stock-transfers/{transfer_id}/items",
    response_model=StockTransferItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_stock_transfer_item(
    transfer_id: int,
    payload: StockTransferItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> StockTransferItemResponse:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", parent.status)

    if payload.from_bin_id == payload.to_bin_id:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="from_bin_id and to_bin_id must differ",
        )

    values = payload.model_dump()
    serial_numbers = _normalize_serial_numbers(values.get("serial_numbers"))
    values["serial_numbers"] = serial_numbers or None
    item = StockTransferItem(stock_transfer_id=transfer_id, **values)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while creating transfer item") from exc

    await db.refresh(item)
    return _to_stock_transfer_item_response(item)


@router.put(
    "/stock-transfers/{transfer_id}/items/{item_id}",
    response_model=StockTransferItemResponse,
)
async def update_stock_transfer_item(
    transfer_id: int,
    item_id: int,
    payload: StockTransferItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> StockTransferItemResponse:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", parent.status)

    item = (
        await db.execute(
            select(StockTransferItem).where(
                StockTransferItem.id == item_id,
                StockTransferItem.stock_transfer_id == transfer_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer item not found")

    updates = payload.model_dump(exclude_unset=True)
    if "serial_numbers" in updates:
        serial_numbers = _normalize_serial_numbers(updates.get("serial_numbers"))
        updates["serial_numbers"] = serial_numbers or None

    from_bin = updates.get("from_bin_id", item.from_bin_id)
    to_bin = updates.get("to_bin_id", item.to_bin_id)
    if from_bin == to_bin:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="from_bin_id and to_bin_id must differ",
        )

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_stock_transfer_item_response(item)


@router.delete("/stock-transfers/{transfer_id}/items/{item_id}", response_model=MessageResponse)
async def delete_stock_transfer_item(
    transfer_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> MessageResponse:
    parent = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", parent.status)

    item = (
        await db.execute(
            select(StockTransferItem).where(
                StockTransferItem.id == item_id,
                StockTransferItem.stock_transfer_id == transfer_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer item not found")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="stock transfer item deleted")


@router.post("/stock-transfers/{transfer_id}/complete", response_model=MessageResponse)
async def complete_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> MessageResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    transfer_items = list(
        (
            await db.execute(select(StockTransferItem).where(StockTransferItem.stock_transfer_id == transfer_id))
        ).scalars()
    )
    if not transfer_items:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Stock transfer has no items",
        )

    now = _now()
    touched_product_ids: set[int] = set()

    try:
        for transfer_item in transfer_items:
            if transfer_item.from_bin_id == transfer_item.to_bin_id:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE,
                    detail=f"Transfer item {transfer_item.id} has same source and target bin",
                )

            quantity = Decimal(transfer_item.quantity)
            serial_numbers = _normalize_serial_numbers(transfer_item.serial_numbers)
            _ensure_quantity_matches_serials(quantity, serial_numbers, item_label=f"Transfer item {transfer_item.id}")
            source_inventory = (
                await db.execute(
                    select(Inventory).where(
                        Inventory.product_id == transfer_item.product_id,
                        Inventory.bin_location_id == transfer_item.from_bin_id,
                    )
                )
            ).scalar_one_or_none()

            if source_inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient stock for product {transfer_item.product_id} "
                        f"at source bin {transfer_item.from_bin_id}"
                    ),
                )

            available_quantity = Decimal(source_inventory.quantity) - Decimal(source_inventory.reserved_quantity)
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient stock for product {transfer_item.product_id} at source bin "
                        f"{transfer_item.from_bin_id} (available={available_quantity}, requested={quantity})"
                    ),
                )

            target_inventory = await _get_inventory(
                db,
                product_id=transfer_item.product_id,
                bin_location_id=transfer_item.to_bin_id,
                unit=transfer_item.unit,
            )

            source_inventory.quantity = Decimal(source_inventory.quantity) - quantity
            target_inventory.quantity = Decimal(target_inventory.quantity) + quantity

            source_batch: InventoryBatch | None = None
            target_batch: InventoryBatch | None = None
            if transfer_item.batch_number:
                source_batch = (
                    await db.execute(
                        select(InventoryBatch).where(
                            InventoryBatch.product_id == transfer_item.product_id,
                            InventoryBatch.bin_location_id == transfer_item.from_bin_id,
                            InventoryBatch.batch_number == transfer_item.batch_number,
                        )
                    )
                ).scalar_one_or_none()
                if source_batch is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Batch {transfer_item.batch_number} not found at source bin",
                    )
                if Decimal(source_batch.quantity) < quantity:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Insufficient batch stock for transfer item {transfer_item.id}",
                    )
                source_batch.quantity = Decimal(source_batch.quantity) - quantity

                target_batch = await _get_inventory_batch(
                    db,
                    product_id=transfer_item.product_id,
                    bin_location_id=transfer_item.to_bin_id,
                    batch_number=source_batch.batch_number,
                    unit=transfer_item.unit,
                    expiry_date=source_batch.expiry_date,
                    manufactured_at=source_batch.manufactured_at,
                )
                target_batch.quantity = Decimal(target_batch.quantity) + quantity

            if serial_numbers:
                serial_rows = list(
                    (
                        await db.execute(
                            select(SerialNumber).where(
                                SerialNumber.serial_number.in_(serial_numbers),
                                SerialNumber.product_id == transfer_item.product_id,
                            )
                        )
                    ).scalars()
                )
                serial_map = {row.serial_number: row for row in serial_rows}
                missing = [serial for serial in serial_numbers if serial not in serial_map]
                if missing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Serial number not found: {missing[0]}",
                    )

                for serial in serial_numbers:
                    serial_row = serial_map[serial]
                    if serial_row.status != "in_stock" or serial_row.current_bin_id != transfer_item.from_bin_id:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Serial number {serial} is not available at source bin",
                        )
                    serial_row.current_bin_id = transfer_item.to_bin_id
                    serial_row.status = "in_stock"
                    serial_row.batch_id = target_batch.id if target_batch else serial_row.batch_id
                    serial_row.last_movement_at = now

            db.add(
                StockMovement(
                    movement_type="stock_transfer",
                    reference_type="stock_transfer",
                    reference_number=item.transfer_number,
                    product_id=transfer_item.product_id,
                    from_bin_id=transfer_item.from_bin_id,
                    to_bin_id=transfer_item.to_bin_id,
                    quantity=quantity,
                    performed_by=current_user.id,
                    performed_at=now,
                    metadata_json={
                        "stock_transfer_id": item.id,
                        "stock_transfer_item_id": transfer_item.id,
                        "batch_number": transfer_item.batch_number,
                        "serial_numbers": serial_numbers or None,
                    },
                )
            )
            touched_product_ids.add(transfer_item.product_id)

        item.status = "completed"
        item.completed_at = now
        if item.transferred_at is None:
            item.transferred_at = now

        await evaluate_alerts(
            db,
            trigger="stock_transfer_completed",
            scoped_product_ids=touched_product_ids or None,
        )
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise

    return MessageResponse(message="stock transfer completed")


@router.post("/stock-transfers/{transfer_id}/cancel", response_model=MessageResponse)
async def cancel_stock_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*STOCK_TRANSFER_ROLES)),
) -> MessageResponse:
    item = (await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    _ensure_draft("Stock transfer", item.status)

    item.status = "cancelled"
    await db.commit()
    return MessageResponse(message="stock transfer cancelled")
