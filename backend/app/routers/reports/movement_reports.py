from .common import *


@router.get("/movements", response_model=ReportMovementResponse)
async def report_movements(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    product_id: int | None = Query(default=None),
    movement_type: str | None = Query(default=None),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
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

    if output != "json":
        return _tabular_response(
            output_format=output,
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
            basename="reports-movements",
        )

    return ReportMovementResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/inbound-outbound", response_model=ReportInboundOutboundResponse)
async def report_inbound_outbound(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
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
                    func.sum(
                        case((StockMovement.movement_type == "inventory_adjustment", StockMovement.quantity), else_=0)
                    ),
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

    if output != "json":
        return _tabular_response(
            output_format=output,
            fieldnames=[
                "day",
                "inbound_quantity",
                "outbound_quantity",
                "transfer_quantity",
                "adjustment_quantity",
                "movement_count",
            ],
            rows=[item.model_dump() for item in items],
            basename="reports-inbound-outbound",
        )

    return ReportInboundOutboundResponse(items=items)


@router.get("/inventory-accuracy", response_model=ReportInventoryAccuracyResponse)
async def report_inventory_accuracy(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
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
    if output != "json":
        return _tabular_response(
            output_format=output,
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
            basename="reports-inventory-accuracy",
        )
    return payload
