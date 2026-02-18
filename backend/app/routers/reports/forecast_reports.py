# ruff: noqa: F403, F405
from .common import *  # noqa: F403, F405


@router.get("/trends", response_model=TrendResponse)
async def report_trends(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    product_id: int | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
) -> TrendResponse | Response:
    _, _, start, end = _date_bounds(date_from, date_to)
    day_expr = func.date(StockMovement.performed_at)
    stmt = (
        select(
            day_expr.label("day"),
            Product.id.label("product_id"),
            Product.product_number.label("product_number"),
            Product.name.label("product_name"),
            func.coalesce(func.sum(StockMovement.quantity), 0).label("outbound_quantity"),
        )
        .join(Product, Product.id == StockMovement.product_id)
        .where(
            StockMovement.movement_type == "goods_issue",
            StockMovement.performed_at >= start,
            StockMovement.performed_at < end,
        )
        .group_by(day_expr, Product.id, Product.product_number, Product.name)
        .order_by(day_expr.asc(), Product.product_number.asc())
    )
    if product_id is not None:
        stmt = stmt.where(StockMovement.product_id == product_id)
    if warehouse_id is not None:
        stmt = stmt.join(BinLocation, BinLocation.id == StockMovement.from_bin_id).join(
            WarehouseZone,
            WarehouseZone.id == BinLocation.zone_id,
        )
        stmt = stmt.where(WarehouseZone.warehouse_id == warehouse_id)

    rows = (await db.execute(stmt)).all()
    items = [
        TrendRow(
            day=date.fromisoformat(str(row.day)),
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            outbound_quantity=row.outbound_quantity,
        )
        for row in rows
    ]

    if output != "json":
        return _tabular_response(
            output_format=output,
            fieldnames=["day", "product_id", "product_number", "product_name", "outbound_quantity"],
            rows=[item.model_dump() for item in items],
            basename="reports-trends",
        )
    return TrendResponse(items=items)


@router.get("/demand-forecast", response_model=DemandForecastResponse)
async def report_demand_forecast(
    run_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
) -> DemandForecastResponse | Response:
    resolved_run_id = run_id
    if resolved_run_id is None:
        latest = (
            await db.execute(
                select(ForecastRun.id).order_by(ForecastRun.generated_at.desc(), ForecastRun.id.desc()).limit(1)
            )
        ).scalar_one_or_none()
        if latest is None:
            return DemandForecastResponse(items=[], total=0)
        resolved_run_id = int(latest)

    stmt = (
        select(ForecastItem, Product.product_number, Product.name.label("product_name"))
        .join(Product, Product.id == ForecastItem.product_id)
        .where(ForecastItem.run_id == resolved_run_id)
    )
    if product_id is not None:
        stmt = stmt.where(ForecastItem.product_id == product_id)
    if warehouse_id is not None:
        stmt = stmt.where(ForecastItem.warehouse_id == warehouse_id)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(stmt.order_by(ForecastItem.id.asc()).offset((page - 1) * page_size).limit(page_size))
    ).all()
    items = [
        # Row layout: (ForecastItem, product_number, product_name)
        DemandForecastRow(
            run_id=row[0].run_id,
            product_id=row[0].product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            warehouse_id=row[0].warehouse_id,
            historical_mean=row[0].historical_mean,
            trend_slope=row[0].trend_slope,
            confidence_score=row[0].confidence_score,
            history_days_used=row[0].history_days_used,
            forecast_qty_7=row[0].forecast_qty_7,
            forecast_qty_30=row[0].forecast_qty_30,
            forecast_qty_90=row[0].forecast_qty_90,
        )
        for row in rows
    ]
    if output != "json":
        return _tabular_response(
            output_format=output,
            fieldnames=[
                "run_id",
                "product_id",
                "product_number",
                "product_name",
                "warehouse_id",
                "historical_mean",
                "trend_slope",
                "confidence_score",
                "history_days_used",
                "forecast_qty_7",
                "forecast_qty_30",
                "forecast_qty_90",
            ],
            rows=[item.model_dump() for item in items],
            basename="reports-demand-forecast",
        )
    return DemandForecastResponse(items=items, total=total)


@router.post("/demand-forecast/recompute", response_model=MessageResponse)
async def recompute_demand_forecast_endpoint(
    payload: DemandForecastRecomputeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions("module.reports.write")),
) -> MessageResponse:
    run, items = await recompute_demand_forecast(
        db,
        generated_by=current_user.id,
        date_from=payload.date_from,
        date_to=payload.date_to,
        warehouse_id=payload.warehouse_id,
    )
    return MessageResponse(message=f"demand forecast recomputed (run_id={run.id}, items={items})")
