from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User
from app.models.phase3 import ApprovalRequest, ApprovalRule
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.routers.purchasing_helpers import _ensure_order_can_be_completed, _now, TRANSITIONS


async def update_purchase_order_status_workflow(
    *,
    db: AsyncSession,
    order_id: int,
    status_value: str,
    current_user: User,
) -> PurchaseOrder:
    item = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    allowed = TRANSITIONS[item.status]
    if status_value not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid status transition: {item.status} -> {status_value}",
        )

    if status_value == "completed":
        await _ensure_order_can_be_completed(db, order_id=item.id)

    if status_value in {"ordered", "completed"}:
        active_rule = (
            await db.execute(
                select(ApprovalRule)
                .where(
                    ApprovalRule.entity_type == "purchase_order",
                    ApprovalRule.is_active.is_(True),
                )
                .order_by(ApprovalRule.id.desc())
            )
        ).scalars().first()
        if active_rule is not None:
            total_amount = (
                await db.execute(
                    select(
                        func.coalesce(
                            func.sum(
                                PurchaseOrderItem.ordered_quantity * func.coalesce(PurchaseOrderItem.unit_price, 0)
                            ),
                            0,
                        )
                    ).where(PurchaseOrderItem.purchase_order_id == item.id)
                )
            ).scalar_one()
            threshold = active_rule.min_amount or 0
            if Decimal(total_amount) >= Decimal(threshold):
                approved = (
                    await db.execute(
                        select(ApprovalRequest.id).where(
                            ApprovalRequest.entity_type == "purchase_order",
                            ApprovalRequest.entity_id == item.id,
                            ApprovalRequest.status == "approved",
                        )
                    )
                ).scalar_one_or_none()
                if approved is None:
                    pending = (
                        await db.execute(
                            select(ApprovalRequest.id).where(
                                ApprovalRequest.entity_type == "purchase_order",
                                ApprovalRequest.entity_id == item.id,
                                ApprovalRequest.status == "pending",
                            )
                        )
                    ).scalar_one_or_none()
                    if pending is None:
                        db.add(
                            ApprovalRequest(
                                entity_type="purchase_order",
                                entity_id=item.id,
                                status="pending",
                                amount=Decimal(total_amount),
                                reason=f"Auto-created by approval rule {active_rule.id}",
                                requested_by=current_user.id,
                                requested_at=_now(),
                            )
                        )
                        await db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Purchase order requires approval before this status transition",
                    )

    item.status = status_value
    now = _now()
    if status_value == "ordered" and item.ordered_at is None:
        item.ordered_at = now
    if status_value == "completed":
        item.completed_at = now

    await db.commit()
    await db.refresh(item)
    return item
