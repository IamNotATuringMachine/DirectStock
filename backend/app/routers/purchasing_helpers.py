from datetime import UTC, datetime
from secrets import token_hex

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.schemas.purchasing import PurchaseOrderItemResponse, PurchaseOrderResponse


TRANSITIONS: dict[str, set[str]] = {
    "draft": {"approved", "cancelled"},
    "approved": {"ordered", "cancelled"},
    "ordered": {"partially_received", "completed", "cancelled"},
    "partially_received": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _to_order_response(item: PurchaseOrder) -> PurchaseOrderResponse:
    return PurchaseOrderResponse(
        id=item.id,
        order_number=item.order_number,
        supplier_id=item.supplier_id,
        status=item.status,
        expected_delivery_at=item.expected_delivery_at,
        ordered_at=item.ordered_at,
        completed_at=item.completed_at,
        supplier_comm_status=item.supplier_comm_status,
        supplier_delivery_date=item.supplier_delivery_date,
        supplier_email_sent_at=item.supplier_email_sent_at,
        supplier_reply_received_at=item.supplier_reply_received_at,
        supplier_last_reply_note=item.supplier_last_reply_note,
        supplier_outbound_message_id=item.supplier_outbound_message_id,
        supplier_last_sync_at=item.supplier_last_sync_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_item_response(item: PurchaseOrderItem) -> PurchaseOrderItemResponse:
    return PurchaseOrderItemResponse(
        id=item.id,
        purchase_order_id=item.purchase_order_id,
        product_id=item.product_id,
        ordered_quantity=item.ordered_quantity,
        received_quantity=item.received_quantity,
        unit=item.unit,
        unit_price=item.unit_price,
        expected_delivery_at=item.expected_delivery_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _ensure_editable(order: PurchaseOrder) -> None:
    if order.status not in {"draft", "approved"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Purchase order is not editable")


def _ensure_receivable(order: PurchaseOrder) -> None:
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


async def _ensure_order_can_be_completed(db: AsyncSession, *, order_id: int) -> None:
    order_items = list(
        (
            await db.execute(
                select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order_id)
            )
        ).scalars()
    )
    if not order_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Purchase order cannot be completed without items",
        )

    open_items = [
        order_item.id
        for order_item in order_items
        if order_item.received_quantity < order_item.ordered_quantity
    ]
    if open_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Purchase order cannot be completed while open quantities remain",
        )
