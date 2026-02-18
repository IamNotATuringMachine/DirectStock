from datetime import UTC, date, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.dependencies import get_db, require_permissions
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
GOODS_ISSUE_READ_PERMISSION = "module.operations.goods_issues.read"
GOODS_ISSUE_WRITE_PERMISSION = "module.operations.goods_issues.write"
STOCK_TRANSFER_READ_PERMISSION = "module.operations.stock_transfers.read"
STOCK_TRANSFER_WRITE_PERMISSION = "module.operations.stock_transfers.write"


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
        await db.execute(select(PurchaseOrderItem).where(PurchaseOrderItem.id == purchase_order_item_id))
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
    item = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == purchase_order_id))).scalar_one_or_none()
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
        product = (await db.execute(select(Product).where(Product.id == item.product_id))).scalar_one_or_none()
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
                await db.execute(select(PurchaseOrderItem).where(PurchaseOrderItem.id == item.purchase_order_item_id))
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


__all__ = [name for name in globals() if not name.startswith("__")]
