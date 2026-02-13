from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_roles
from app.models.auth import User
from app.models.catalog import Product
from app.models.inventory import StockMovement
from app.models.phase3 import AbcClassificationItem, AbcClassificationRun
from app.schemas.phase3 import (
    AbcClassificationItemResponse,
    AbcClassificationListResponse,
    AbcClassificationRunResponse,
    AbcRecomputeRequest,
)

router = APIRouter(prefix="/api/abc-classifications", tags=["abc-classifications"])

READ_ROLES = ("admin", "lagerleiter", "einkauf", "controller", "auditor")
WRITE_ROLES = ("admin", "lagerleiter", "einkauf")


def _quantize(value: Decimal, digits: str = "0.01") -> Decimal:
    return value.quantize(Decimal(digits), rounding=ROUND_HALF_UP)


def _date_window(payload: AbcRecomputeRequest) -> tuple[date, date]:
    today = datetime.now(UTC).date()
    date_to = payload.date_to or today
    date_from = payload.date_from or (date_to - timedelta(days=89))
    if date_to < date_from:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="date_to must be >= date_from")
    return date_from, date_to


def _run_response(item: AbcClassificationRun) -> AbcClassificationRunResponse:
    return AbcClassificationRunResponse(
        id=item.id,
        date_from=item.date_from,
        date_to=item.date_to,
        total_outbound_quantity=item.total_outbound_quantity,
        generated_by=item.generated_by,
        generated_at=item.generated_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.post("/recompute", response_model=AbcClassificationRunResponse)
async def recompute_abc_classification(
    payload: AbcRecomputeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> AbcClassificationRunResponse:
    date_from, date_to = _date_window(payload)
    start = datetime.combine(date_from, datetime.min.time(), tzinfo=UTC)
    end = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=UTC)

    rows = list(
        (
            await db.execute(
                select(
                    Product.id.label("product_id"),
                    Product.product_number.label("product_number"),
                    Product.name.label("product_name"),
                    func.coalesce(func.sum(StockMovement.quantity), 0).label("outbound_quantity"),
                )
                .join(StockMovement, StockMovement.product_id == Product.id)
                .where(
                    StockMovement.movement_type == "goods_issue",
                    StockMovement.performed_at >= start,
                    StockMovement.performed_at < end,
                )
                .group_by(Product.id, Product.product_number, Product.name)
                .order_by(func.sum(StockMovement.quantity).desc(), Product.id.asc())
            )
        ).all()
    )

    total_outbound = sum(Decimal(row.outbound_quantity or 0) for row in rows)

    run = AbcClassificationRun(
        date_from=date_from,
        date_to=date_to,
        total_outbound_quantity=total_outbound,
        generated_by=current_user.id,
        generated_at=datetime.now(UTC),
    )
    db.add(run)
    await db.flush()

    cumulative = Decimal("0")
    for index, row in enumerate(rows, start=1):
        outbound_quantity = Decimal(row.outbound_quantity or 0)
        share_percent = (
            _quantize(outbound_quantity * Decimal("100") / total_outbound)
            if total_outbound > 0
            else Decimal("0")
        )
        cumulative = _quantize(cumulative + share_percent)
        if cumulative <= Decimal("80.00"):
            category = "A"
        elif cumulative <= Decimal("95.00"):
            category = "B"
        else:
            category = "C"

        db.add(
            AbcClassificationItem(
                run_id=run.id,
                rank=index,
                product_id=row.product_id,
                outbound_quantity=outbound_quantity,
                share_percent=share_percent,
                cumulative_share_percent=cumulative,
                category=category,
            )
        )

    await db.commit()
    await db.refresh(run)
    return _run_response(run)


@router.get("", response_model=AbcClassificationListResponse)
async def list_abc_classification(
    run_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> AbcClassificationListResponse:
    if run_id is None:
        run = (
            await db.execute(select(AbcClassificationRun).order_by(AbcClassificationRun.id.desc()))
        ).scalars().first()
    else:
        run = (await db.execute(select(AbcClassificationRun).where(AbcClassificationRun.id == run_id))).scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ABC classification run found")

    rows = (
        await db.execute(
            select(
                AbcClassificationItem,
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
            )
            .join(Product, Product.id == AbcClassificationItem.product_id)
            .where(AbcClassificationItem.run_id == run.id)
            .order_by(AbcClassificationItem.rank.asc())
        )
    ).all()

    items = [
        AbcClassificationItemResponse(
            id=row[0].id,
            run_id=row[0].run_id,
            rank=row[0].rank,
            product_id=row[0].product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            outbound_quantity=row[0].outbound_quantity,
            share_percent=row[0].share_percent,
            cumulative_share_percent=row[0].cumulative_share_percent,
            category=row[0].category,
            created_at=row[0].created_at,
            updated_at=row[0].updated_at,
        )
        for row in rows
    ]

    return AbcClassificationListResponse(run=_run_response(run), items=items)
