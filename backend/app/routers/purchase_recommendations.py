from datetime import UTC, datetime
from decimal import Decimal, ROUND_CEILING
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_roles
from app.models.auth import User
from app.models.catalog import ProductSupplier, ProductWarehouseSetting
from app.models.inventory import Inventory
from app.models.phase3 import PurchaseRecommendation
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse import BinLocation, WarehouseZone
from app.schemas.phase3 import (
    PurchaseRecommendationConvertResponse,
    PurchaseRecommendationGenerateRequest,
    PurchaseRecommendationListResponse,
    PurchaseRecommendationResponse,
)

router = APIRouter(prefix="/api/purchase-recommendations", tags=["purchase-recommendations"])

READ_ROLES = ("admin", "lagerleiter", "einkauf", "controller", "auditor")
WRITE_ROLES = ("admin", "lagerleiter", "einkauf")


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _round_up_to_multiple(value: Decimal, multiple: Decimal) -> Decimal:
    if value <= 0:
        return Decimal("0")
    if multiple <= 0:
        multiple = Decimal("1")
    multiplier = (value / multiple).to_integral_value(rounding=ROUND_CEILING)
    return multiplier * multiple


def _to_response(item: PurchaseRecommendation) -> PurchaseRecommendationResponse:
    return PurchaseRecommendationResponse(
        id=item.id,
        product_id=item.product_id,
        warehouse_id=item.warehouse_id,
        supplier_id=item.supplier_id,
        status=item.status,
        target_stock=item.target_stock,
        on_hand_quantity=item.on_hand_quantity,
        open_po_quantity=item.open_po_quantity,
        deficit_quantity=item.deficit_quantity,
        recommended_quantity=item.recommended_quantity,
        min_order_quantity=item.min_order_quantity,
        converted_purchase_order_id=item.converted_purchase_order_id,
        generated_by=item.generated_by,
        generated_at=item.generated_at,
        metadata_json=item.metadata_json,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _preferred_supplier_id(db: AsyncSession, product_id: int) -> tuple[int | None, Decimal]:
    relation = (
        await db.execute(
            select(ProductSupplier)
            .where(ProductSupplier.product_id == product_id)
            .order_by(ProductSupplier.is_preferred.desc(), ProductSupplier.id.asc())
        )
    ).scalars().first()
    if relation is None:
        return None, Decimal("1")
    min_order = Decimal(relation.min_order_quantity or 1)
    if min_order <= 0:
        min_order = Decimal("1")
    return relation.supplier_id, min_order


@router.post("/generate", response_model=PurchaseRecommendationListResponse)
async def generate_purchase_recommendations(
    payload: PurchaseRecommendationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> PurchaseRecommendationListResponse:
    settings_stmt = select(ProductWarehouseSetting)
    if payload.warehouse_id is not None:
        settings_stmt = settings_stmt.where(ProductWarehouseSetting.warehouse_id == payload.warehouse_id)

    settings = list((await db.execute(settings_stmt)).scalars())
    created_items: list[PurchaseRecommendation] = []

    for setting in settings:
        on_hand_stmt = (
            select(func.coalesce(func.sum(Inventory.quantity), 0))
            .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
            .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
            .where(Inventory.product_id == setting.product_id)
        )
        if setting.warehouse_id is not None:
            on_hand_stmt = on_hand_stmt.where(WarehouseZone.warehouse_id == setting.warehouse_id)
        on_hand = Decimal((await db.execute(on_hand_stmt)).scalar_one())

        open_po = Decimal(
            (
                await db.execute(
                    select(func.coalesce(func.sum(PurchaseOrderItem.ordered_quantity - PurchaseOrderItem.received_quantity), 0))
                    .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
                    .where(
                        PurchaseOrderItem.product_id == setting.product_id,
                        PurchaseOrder.status.in_(["draft", "approved", "ordered", "partially_received"]),
                    )
                )
            ).scalar_one()
        )

        target_stock = Decimal(setting.reorder_point or setting.min_stock or 0) + Decimal(setting.safety_stock or 0)
        deficit = target_stock - on_hand - open_po
        if deficit <= 0:
            continue

        supplier_id, min_order_quantity = await _preferred_supplier_id(db, setting.product_id)
        recommended = _round_up_to_multiple(deficit, min_order_quantity)

        recommendation = PurchaseRecommendation(
            product_id=setting.product_id,
            warehouse_id=setting.warehouse_id,
            supplier_id=supplier_id,
            status="open",
            target_stock=target_stock,
            on_hand_quantity=on_hand,
            open_po_quantity=open_po,
            deficit_quantity=deficit,
            recommended_quantity=recommended,
            min_order_quantity=min_order_quantity,
            generated_by=current_user.id,
            generated_at=datetime.now(UTC),
            metadata_json={
                "formula": "target_stock - on_hand - open_po",
            },
        )
        db.add(recommendation)
        created_items.append(recommendation)

    await db.commit()
    for item in created_items:
        await db.refresh(item)

    return PurchaseRecommendationListResponse(items=[_to_response(item) for item in created_items], total=len(created_items))


@router.get("", response_model=PurchaseRecommendationListResponse)
async def list_purchase_recommendations(
    status_filter: str | None = Query(default=None, alias="status"),
    warehouse_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> PurchaseRecommendationListResponse:
    stmt = select(PurchaseRecommendation).order_by(PurchaseRecommendation.generated_at.desc(), PurchaseRecommendation.id.desc())
    if status_filter:
        stmt = stmt.where(PurchaseRecommendation.status == status_filter)
    if warehouse_id is not None:
        stmt = stmt.where(PurchaseRecommendation.warehouse_id == warehouse_id)
    if product_id is not None:
        stmt = stmt.where(PurchaseRecommendation.product_id == product_id)

    rows = list((await db.execute(stmt)).scalars())
    return PurchaseRecommendationListResponse(items=[_to_response(item) for item in rows], total=len(rows))


@router.post("/{recommendation_id}/convert-to-po", response_model=PurchaseRecommendationConvertResponse)
async def convert_recommendation_to_purchase_order(
    recommendation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> PurchaseRecommendationConvertResponse:
    recommendation = (
        await db.execute(select(PurchaseRecommendation).where(PurchaseRecommendation.id == recommendation_id))
    ).scalar_one_or_none()
    if recommendation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase recommendation not found")
    if recommendation.status != "open":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Recommendation is not open")

    if recommendation.supplier_id is None:
        supplier_id, _ = await _preferred_supplier_id(db, recommendation.product_id)
        recommendation.supplier_id = supplier_id

    if recommendation.supplier_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No supplier available for recommendation")

    purchase_order = PurchaseOrder(
        order_number=_generate_number("PO"),
        supplier_id=recommendation.supplier_id,
        status="draft",
        created_by=current_user.id,
        notes=f"Auto-created from recommendation {recommendation.id}",
    )
    db.add(purchase_order)
    await db.flush()

    db.add(
        PurchaseOrderItem(
            purchase_order_id=purchase_order.id,
            product_id=recommendation.product_id,
            ordered_quantity=recommendation.recommended_quantity,
            received_quantity=0,
            unit="piece",
            unit_price=None,
        )
    )

    recommendation.status = "converted"
    recommendation.converted_purchase_order_id = purchase_order.id

    await db.commit()
    await db.refresh(purchase_order)

    return PurchaseRecommendationConvertResponse(
        recommendation_id=recommendation.id,
        purchase_order_id=purchase_order.id,
        purchase_order_number=purchase_order.order_number,
    )


@router.post("/{recommendation_id}/dismiss", response_model=PurchaseRecommendationResponse)
async def dismiss_recommendation(
    recommendation_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> PurchaseRecommendationResponse:
    recommendation = (
        await db.execute(select(PurchaseRecommendation).where(PurchaseRecommendation.id == recommendation_id))
    ).scalar_one_or_none()
    if recommendation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase recommendation not found")

    recommendation.status = "dismissed"
    await db.commit()
    await db.refresh(recommendation)
    return _to_response(recommendation)
