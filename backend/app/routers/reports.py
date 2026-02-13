import csv
import io
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.dependencies import get_db, require_roles
from app.models.alerts import AlertEvent
from app.models.catalog import Product
from app.models.inventory import Inventory, InventoryCountItem, InventoryCountSession, StockMovement, GoodsReceipt
from app.models.warehouse import BinLocation, WarehouseZone
from app.schemas.reports import (
    ReportAbcResponse,
    ReportAbcRow,
    ReportInboundOutboundResponse,
    ReportInboundOutboundRow,
    ReportInventoryAccuracyResponse,
    ReportInventoryAccuracySessionRow,
    ReportKpiResponse,
    ReportMovementResponse,
    ReportMovementRow,
    ReportStockResponse,
    ReportStockRow,
)
from app.utils.http_status import HTTP_422_UNPROCESSABLE

router = APIRouter(prefix="/api/reports", tags=["reports"])
REPORTS_READ_ROLES = ("admin", "lagerleiter", "einkauf", "controller")


def _quantize(value: Decimal, digits: str = "0.01") -> Decimal:
    return value.quantize(Decimal(digits), rounding=ROUND_HALF_UP)


def _date_bounds(date_from: date | None, date_to: date | None) -> tuple[date, date, datetime, datetime]:
    today = datetime.now(UTC).date()
    start_day = date_from or (today - timedelta(days=29))
    end_day = date_to or today
    if end_day < start_day:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="date_to must be greater than or equal to date_from",
        )
    start = datetime.combine(start_day, time.min, tzinfo=UTC)
    end = datetime.combine(end_day + timedelta(days=1), time.min, tzinfo=UTC)
    return start_day, end_day, start, end


def _csv_response(fieldnames: list[str], rows: list[dict[str, object]], filename: str) -> Response:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                key: value.isoformat() if isinstance(value, (datetime, date)) else value
                for key, value in row.items()
            }
        )
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_inventory_accuracy(
    rows: list,
) -> tuple[list[ReportInventoryAccuracySessionRow], ReportInventoryAccuracyResponse]:
    sessions: list[ReportInventoryAccuracySessionRow] = []
    total_items = 0
    counted_items = 0
    exact_match_items = 0
    recount_required_items = 0

    for row in rows:
        row_total = int(row.total_items or 0)
        row_counted = int(row.counted_items or 0)
        row_exact = int(row.exact_match_items or 0)
        row_recount = int(row.recount_required_items or 0)
        accuracy_percent = _quantize(
            (Decimal(row_exact) * Decimal("100") / Decimal(row_counted))
            if row_counted
            else Decimal("0")
        )
        sessions.append(
            ReportInventoryAccuracySessionRow(
                session_id=row.session_id,
                session_number=row.session_number,
                completed_at=row.completed_at,
                total_items=row_total,
                counted_items=row_counted,
                exact_match_items=row_exact,
                recount_required_items=row_recount,
                accuracy_percent=accuracy_percent,
            )
        )
        total_items += row_total
        counted_items += row_counted
        exact_match_items += row_exact
        recount_required_items += row_recount

    overall_accuracy_percent = _quantize(
        (Decimal(exact_match_items) * Decimal("100") / Decimal(counted_items))
        if counted_items
        else Decimal("0")
    )
    payload = ReportInventoryAccuracyResponse(
        total_sessions=len(sessions),
        total_items=total_items,
        counted_items=counted_items,
        exact_match_items=exact_match_items,
        recount_required_items=recount_required_items,
        overall_accuracy_percent=overall_accuracy_percent,
        sessions=sessions,
    )
    return sessions, payload


@router.get("/stock", response_model=ReportStockResponse)
async def report_stock(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    search: str | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    output: Literal["json", "csv"] = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*REPORTS_READ_ROLES)),
) -> ReportStockResponse | Response:
    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(Product.product_number.ilike(term), Product.name.ilike(term)))
    if warehouse_id is not None:
        filters.append(WarehouseZone.warehouse_id == warehouse_id)

    stmt = (
        select(
            Product.id.label("product_id"),
            Product.product_number.label("product_number"),
            Product.name.label("product_name"),
            func.sum(Inventory.quantity).label("total_quantity"),
            func.sum(Inventory.reserved_quantity).label("reserved_quantity"),
            func.min(Inventory.unit).label("unit"),
        )
        .join(Inventory, Inventory.product_id == Product.id)
        .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
        .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
    )
    if filters:
        stmt = stmt.where(*filters)
    stmt = stmt.group_by(Product.id, Product.product_number, Product.name)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(Product.product_number.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    items = [
        ReportStockRow(
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            total_quantity=row.total_quantity,
            reserved_quantity=row.reserved_quantity,
            available_quantity=row.total_quantity - row.reserved_quantity,
            unit=row.unit,
        )
        for row in rows
    ]

    if output == "csv":
        return _csv_response(
            fieldnames=[
                "product_id",
                "product_number",
                "product_name",
                "total_quantity",
                "reserved_quantity",
                "available_quantity",
                "unit",
            ],
            rows=[item.model_dump() for item in items],
            filename="reports-stock.csv",
        )

    return ReportStockResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/movements", response_model=ReportMovementResponse)
async def report_movements(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    product_id: int | None = Query(default=None),
    movement_type: str | None = Query(default=None),
    output: Literal["json", "csv"] = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*REPORTS_READ_ROLES)),
) -> ReportMovementResponse | Response:
    _, _, start, end = _date_bounds(date_from, date_to)
    from_bin = aliased(BinLocation)
    to_bin = aliased(BinLocation)

    stmt = (
        select(
            StockMovement.id,
            StockMovement.movement_type,
            StockMovement.reference_type,
            StockMovement.reference_number,
            StockMovement.product_id,
            Product.product_number,
            Product.name.label("product_name"),
            from_bin.code.label("from_bin_code"),
            to_bin.code.label("to_bin_code"),
            StockMovement.quantity,
            StockMovement.performed_at,
        )
        .join(Product, Product.id == StockMovement.product_id)
        .outerjoin(from_bin, from_bin.id == StockMovement.from_bin_id)
        .outerjoin(to_bin, to_bin.id == StockMovement.to_bin_id)
        .where(StockMovement.performed_at >= start, StockMovement.performed_at < end)
    )
    if product_id is not None:
        stmt = stmt.where(StockMovement.product_id == product_id)
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type == movement_type)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(StockMovement.performed_at.desc(), StockMovement.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    items = [
        ReportMovementRow(
            id=row.id,
            movement_type=row.movement_type,
            reference_type=row.reference_type,
            reference_number=row.reference_number,
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            from_bin_code=row.from_bin_code,
            to_bin_code=row.to_bin_code,
            quantity=row.quantity,
            performed_at=row.performed_at,
        )
        for row in rows
    ]

    if output == "csv":
        return _csv_response(
            fieldnames=[
                "id",
                "movement_type",
                "reference_type",
                "reference_number",
                "product_id",
                "product_number",
                "product_name",
                "from_bin_code",
                "to_bin_code",
                "quantity",
                "performed_at",
            ],
            rows=[item.model_dump() for item in items],
            filename="reports-movements.csv",
        )

    return ReportMovementResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/inbound-outbound", response_model=ReportInboundOutboundResponse)
async def report_inbound_outbound(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    output: Literal["json", "csv"] = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*REPORTS_READ_ROLES)),
) -> ReportInboundOutboundResponse | Response:
    _, _, start, end = _date_bounds(date_from, date_to)
    day_expr = func.date(StockMovement.performed_at)
    rows = (
        await db.execute(
            select(
                day_expr.label("day"),
                func.coalesce(
                    func.sum(case((StockMovement.movement_type == "goods_receipt", StockMovement.quantity), else_=0)),
                    0,
                ).label("inbound_quantity"),
                func.coalesce(
                    func.sum(case((StockMovement.movement_type == "goods_issue", StockMovement.quantity), else_=0)),
                    0,
                ).label("outbound_quantity"),
                func.coalesce(
                    func.sum(case((StockMovement.movement_type == "stock_transfer", StockMovement.quantity), else_=0)),
                    0,
                ).label("transfer_quantity"),
                func.coalesce(
                    func.sum(case((StockMovement.movement_type == "inventory_adjustment", StockMovement.quantity), else_=0)),
                    0,
                ).label("adjustment_quantity"),
                func.count(StockMovement.id).label("movement_count"),
            )
            .where(StockMovement.performed_at >= start, StockMovement.performed_at < end)
            .group_by(day_expr)
            .order_by(day_expr.asc())
        )
    ).all()

    items = [
        ReportInboundOutboundRow(
            day=date.fromisoformat(str(row.day)),
            inbound_quantity=row.inbound_quantity,
            outbound_quantity=row.outbound_quantity,
            transfer_quantity=row.transfer_quantity,
            adjustment_quantity=row.adjustment_quantity,
            movement_count=int(row.movement_count),
        )
        for row in rows
    ]

    if output == "csv":
        return _csv_response(
            fieldnames=[
                "day",
                "inbound_quantity",
                "outbound_quantity",
                "transfer_quantity",
                "adjustment_quantity",
                "movement_count",
            ],
            rows=[item.model_dump() for item in items],
            filename="reports-inbound-outbound.csv",
        )

    return ReportInboundOutboundResponse(items=items)


@router.get("/inventory-accuracy", response_model=ReportInventoryAccuracyResponse)
async def report_inventory_accuracy(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    output: Literal["json", "csv"] = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*REPORTS_READ_ROLES)),
) -> ReportInventoryAccuracyResponse | Response:
    _, _, start, end = _date_bounds(date_from, date_to)
    rows = (
        await db.execute(
            select(
                InventoryCountSession.id.label("session_id"),
                InventoryCountSession.session_number.label("session_number"),
                InventoryCountSession.completed_at.label("completed_at"),
                func.count(InventoryCountItem.id).label("total_items"),
                func.sum(case((InventoryCountItem.counted_quantity.is_not(None), 1), else_=0)).label("counted_items"),
                func.sum(case((InventoryCountItem.difference_quantity == 0, 1), else_=0)).label("exact_match_items"),
                func.sum(case((InventoryCountItem.recount_required.is_(True), 1), else_=0)).label(
                    "recount_required_items"
                ),
            )
            .join(
                InventoryCountItem,
                InventoryCountItem.session_id == InventoryCountSession.id,
                isouter=True,
            )
            .where(
                InventoryCountSession.status == "completed",
                InventoryCountSession.completed_at.is_not(None),
                InventoryCountSession.completed_at >= start,
                InventoryCountSession.completed_at < end,
            )
            .group_by(
                InventoryCountSession.id,
                InventoryCountSession.session_number,
                InventoryCountSession.completed_at,
            )
            .order_by(InventoryCountSession.completed_at.desc(), InventoryCountSession.id.desc())
        )
    ).all()

    sessions, payload = _build_inventory_accuracy(rows)
    if output == "csv":
        return _csv_response(
            fieldnames=[
                "session_id",
                "session_number",
                "completed_at",
                "total_items",
                "counted_items",
                "exact_match_items",
                "recount_required_items",
                "accuracy_percent",
            ],
            rows=[item.model_dump() for item in sessions],
            filename="reports-inventory-accuracy.csv",
        )
    return payload


@router.get("/abc", response_model=ReportAbcResponse)
async def report_abc(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    output: Literal["json", "csv"] = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*REPORTS_READ_ROLES)),
) -> ReportAbcResponse | Response:
    _, _, start, end = _date_bounds(date_from, date_to)
    stmt = (
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
    )
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(Product.product_number.ilike(term), Product.name.ilike(term)))

    rows = list((await db.execute(stmt.order_by(func.sum(StockMovement.quantity).desc(), Product.id.asc()))).all())
    total_outbound = sum(Decimal(row.outbound_quantity or 0) for row in rows)
    cumulative = Decimal("0")

    items: list[ReportAbcRow] = []
    for index, row in enumerate(rows, start=1):
        outbound_quantity = Decimal(row.outbound_quantity or 0)
        share = (
            _quantize(outbound_quantity * Decimal("100") / total_outbound)
            if total_outbound > 0
            else Decimal("0")
        )
        cumulative = _quantize(cumulative + share)
        if cumulative <= Decimal("80.00"):
            category = "A"
        elif cumulative <= Decimal("95.00"):
            category = "B"
        else:
            category = "C"
        items.append(
            ReportAbcRow(
                rank=index,
                product_id=row.product_id,
                product_number=row.product_number,
                product_name=row.product_name,
                outbound_quantity=outbound_quantity,
                share_percent=share,
                cumulative_share_percent=cumulative,
                category=category,
            )
        )

    if output == "csv":
        return _csv_response(
            fieldnames=[
                "rank",
                "product_id",
                "product_number",
                "product_name",
                "outbound_quantity",
                "share_percent",
                "cumulative_share_percent",
                "category",
            ],
            rows=[item.model_dump() for item in items],
            filename="reports-abc.csv",
        )
    return ReportAbcResponse(items=items)


@router.get("/kpis", response_model=ReportKpiResponse)
async def report_kpis(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*REPORTS_READ_ROLES)),
) -> ReportKpiResponse:
    start_day, end_day, start, end = _date_bounds(date_from, date_to)
    outbound_total = (
        await db.execute(
            select(func.coalesce(func.sum(StockMovement.quantity), 0)).where(
                StockMovement.movement_type == "goods_issue",
                StockMovement.performed_at >= start,
                StockMovement.performed_at < end,
            )
        )
    ).scalar_one()
    current_on_hand = (
        await db.execute(select(func.coalesce(func.sum(Inventory.quantity), 0)))
    ).scalar_one()
    turnover_rate = (
        _quantize(Decimal(outbound_total) / Decimal(current_on_hand), "0.0001")
        if Decimal(current_on_hand) > 0
        else Decimal("0.0000")
    )

    receipt_rows = (
        await db.execute(
            select(GoodsReceipt.created_at, GoodsReceipt.completed_at).where(
                GoodsReceipt.completed_at.is_not(None),
                GoodsReceipt.completed_at >= start,
                GoodsReceipt.completed_at < end,
            )
        )
    ).all()
    dock_to_stock_hours_values = [
        Decimal((row.completed_at - row.created_at).total_seconds()) / Decimal("3600")
        for row in receipt_rows
        if row.completed_at and row.created_at
    ]
    dock_to_stock_hours = (
        _quantize(sum(dock_to_stock_hours_values) / Decimal(len(dock_to_stock_hours_values)))
        if dock_to_stock_hours_values
        else Decimal("0.00")
    )

    accuracy_rows = (
        await db.execute(
            select(
                InventoryCountSession.id.label("session_id"),
                InventoryCountSession.session_number.label("session_number"),
                InventoryCountSession.completed_at.label("completed_at"),
                func.count(InventoryCountItem.id).label("total_items"),
                func.sum(case((InventoryCountItem.counted_quantity.is_not(None), 1), else_=0)).label("counted_items"),
                func.sum(case((InventoryCountItem.difference_quantity == 0, 1), else_=0)).label("exact_match_items"),
                func.sum(case((InventoryCountItem.recount_required.is_(True), 1), else_=0)).label(
                    "recount_required_items"
                ),
            )
            .join(
                InventoryCountItem,
                InventoryCountItem.session_id == InventoryCountSession.id,
                isouter=True,
            )
            .where(
                InventoryCountSession.status == "completed",
                InventoryCountSession.completed_at.is_not(None),
                InventoryCountSession.completed_at >= start,
                InventoryCountSession.completed_at < end,
            )
            .group_by(
                InventoryCountSession.id,
                InventoryCountSession.session_number,
                InventoryCountSession.completed_at,
            )
        )
    ).all()
    _, accuracy_payload = _build_inventory_accuracy(accuracy_rows)
    alert_count = (
        await db.execute(
            select(func.count(AlertEvent.id)).where(AlertEvent.status == "open")
        )
    ).scalar_one()

    return ReportKpiResponse(
        date_from=start_day,
        date_to=end_day,
        turnover_rate=turnover_rate,
        dock_to_stock_hours=dock_to_stock_hours,
        inventory_accuracy_percent=accuracy_payload.overall_accuracy_percent,
        alert_count=alert_count,
    )
