from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import GoodsIssue, GoodsIssueItem
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.routers.external_api_helpers import _generate_number, _resolve_customer_scope
from app.schemas.phase4 import ExternalCommandGoodsIssueCreate, ExternalCommandPurchaseOrderCreate


async def create_external_purchase_order(
    *,
    db: AsyncSession,
    payload: ExternalCommandPurchaseOrderCreate,
) -> PurchaseOrder:
    order = PurchaseOrder(
        order_number=payload.order_number or _generate_number("EPO"),
        supplier_id=payload.supplier_id,
        expected_delivery_at=payload.expected_delivery_at,
        notes=payload.notes,
        status="draft",
        created_by=None,
    )
    db.add(order)
    await db.flush()

    for item in payload.items:
        db.add(
            PurchaseOrderItem(
                purchase_order_id=order.id,
                product_id=item.product_id,
                ordered_quantity=item.ordered_quantity,
                unit=item.unit,
                unit_price=item.unit_price,
            )
        )

    await db.commit()
    return order


async def create_external_goods_issue(
    *,
    db: AsyncSession,
    payload: ExternalCommandGoodsIssueCreate,
) -> GoodsIssue:
    customer_id, customer_location_id = await _resolve_customer_scope(
        db,
        customer_id=payload.customer_id,
        customer_location_id=payload.customer_location_id,
    )

    issue = GoodsIssue(
        issue_number=payload.issue_number or _generate_number("EGI"),
        customer_id=customer_id,
        customer_location_id=customer_location_id,
        customer_reference=payload.customer_reference,
        notes=payload.notes,
        status="draft",
        created_by=None,
    )
    db.add(issue)
    await db.flush()

    for item in payload.items:
        db.add(
            GoodsIssueItem(
                goods_issue_id=issue.id,
                product_id=item.product_id,
                requested_quantity=item.requested_quantity,
                issued_quantity=item.requested_quantity,
                unit=item.unit,
                source_bin_id=item.source_bin_id,
                batch_number=item.batch_number,
                use_fefo=item.use_fefo,
                serial_numbers=item.serial_numbers,
            )
        )

    await db.commit()
    return issue
