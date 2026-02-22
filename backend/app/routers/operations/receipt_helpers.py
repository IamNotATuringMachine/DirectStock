from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Product
from app.models.inventory import GoodsReceipt, GoodsReceiptItem
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse import BinLocation, WarehouseZone
from app.schemas.operations import GoodsReceiptItemResponse
from app.utils.http_status import HTTP_422_UNPROCESSABLE

from .response_mappers import _to_goods_receipt_item_response


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
    if order.supplier_comm_status not in {"confirmed_with_date", "confirmed_undetermined"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Purchase order {order.order_number} is not supplier-confirmed for goods receipt",
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
