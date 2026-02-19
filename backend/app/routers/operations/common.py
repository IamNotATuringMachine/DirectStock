from datetime import date, datetime
from decimal import Decimal

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
from app.services.operations.inventory_service import (
    get_or_create_inventory,
    get_or_create_inventory_batch,
)
from app.services.operations.issue_service import serial_tracked_quantity_is_integer
from app.services.operations.receipt_service import generate_document_number, now_utc
from app.services.operations.transfer_service import is_draft_status
from app.utils.http_status import HTTP_422_UNPROCESSABLE
from app.utils.qr_generator import generate_item_labels_pdf, generate_serial_labels_pdf
from .receipt_helpers import (
    _build_goods_receipt_item_response,
    _ensure_purchase_order_ready_for_receipt,
    _get_purchase_order_item_or_404,
    _get_purchase_order_or_404,
    _get_repair_center_bin_or_422,
    _is_condition_required_for_receipt,
    _resolve_receipt_mode,
    _resolve_receipt_source_type,
    _validate_receipt_mode_constraints,
)
from .response_mappers import (
    _to_goods_issue_item_response,
    _to_goods_issue_response,
    _to_goods_receipt_item_response,
    _to_goods_receipt_response,
    _to_product_response,
    _to_stock_transfer_item_response,
    _to_stock_transfer_response,
)

router = APIRouter(prefix="/api", tags=["operations"])

GOODS_RECEIPT_READ_PERMISSION = "module.goods_receipts.read"
GOODS_RECEIPT_WRITE_PERMISSION = "module.goods_receipts.write"
GOODS_ISSUE_READ_PERMISSION = "module.operations.goods_issues.read"
GOODS_ISSUE_WRITE_PERMISSION = "module.operations.goods_issues.write"
STOCK_TRANSFER_READ_PERMISSION = "module.operations.stock_transfers.read"
STOCK_TRANSFER_WRITE_PERMISSION = "module.operations.stock_transfers.write"


def _now() -> datetime:
    return now_utc()


def _generate_number(prefix: str) -> str:
    return generate_document_number(prefix)


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
    return await get_or_create_inventory(
        db,
        product_id=product_id,
        bin_location_id=bin_location_id,
        unit=unit,
    )


def _ensure_draft(entity_name: str, current_status: str) -> None:
    if not is_draft_status(current_status):
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
    return await get_or_create_inventory_batch(
        db,
        product_id=product_id,
        bin_location_id=bin_location_id,
        batch_number=batch_number,
        unit=unit,
        expiry_date=expiry_date,
        manufactured_at=manufactured_at,
    )


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


def _ensure_serial_tracked_quantity_is_integer(quantity: Decimal, *, item_label: str) -> None:
    if not serial_tracked_quantity_is_integer(quantity):
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail=f"{item_label} requires integer quantity for tracked items",
        )


__all__ = [name for name in globals() if not name.startswith("__")]
