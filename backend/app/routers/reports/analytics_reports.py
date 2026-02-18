from .common import *


@router.get("/abc", response_model=ReportAbcResponse)
async def report_abc(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
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
        share = _quantize(outbound_quantity * Decimal("100") / total_outbound) if total_outbound > 0 else Decimal("0")
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

    if output != "json":
        return _tabular_response(
            output_format=output,
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
            basename="reports-abc",
        )
    return ReportAbcResponse(items=items)


@router.get("/returns", response_model=ReportReturnsResponse)
async def report_returns(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
) -> ReportReturnsResponse | Response:
    _, _, start, end = _date_bounds(date_from, date_to)
    stmt = (
        select(
            ReturnOrder.id.label("return_order_id"),
            ReturnOrder.return_number.label("return_number"),
            ReturnOrder.status.label("status"),
            ReturnOrder.created_at.label("created_at"),
            func.count(ReturnOrderItem.id).label("total_items"),
            func.coalesce(func.sum(ReturnOrderItem.quantity), 0).label("total_quantity"),
            func.sum(case((ReturnOrderItem.decision == "restock", 1), else_=0)).label("restock_items"),
            func.sum(
                case(
                    (
                        and_(
                            ReturnOrderItem.decision == "repair",
                            ReturnOrderItem.repair_mode == "internal",
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("internal_repair_items"),
            func.sum(
                case(
                    (
                        and_(
                            ReturnOrderItem.decision == "repair",
                            ReturnOrderItem.repair_mode == "external",
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("external_repair_items"),
            func.sum(case((ReturnOrderItem.decision == "scrap", 1), else_=0)).label("scrap_items"),
            func.sum(case((ReturnOrderItem.decision == "return_supplier", 1), else_=0)).label("return_supplier_items"),
        )
        .join(ReturnOrderItem, ReturnOrderItem.return_order_id == ReturnOrder.id, isouter=True)
        .where(ReturnOrder.created_at >= start, ReturnOrder.created_at < end)
        .group_by(ReturnOrder.id, ReturnOrder.return_number, ReturnOrder.status, ReturnOrder.created_at)
    )

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(ReturnOrder.created_at.desc(), ReturnOrder.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    items = [
        ReportReturnsRow(
            return_order_id=row.return_order_id,
            return_number=row.return_number,
            status=row.status,
            total_items=int(row.total_items or 0),
            total_quantity=Decimal(row.total_quantity or 0),
            restock_items=int(row.restock_items or 0),
            internal_repair_items=int(row.internal_repair_items or 0),
            external_repair_items=int(row.external_repair_items or 0),
            scrap_items=int(row.scrap_items or 0),
            return_supplier_items=int(row.return_supplier_items or 0),
            created_at=row.created_at,
        )
        for row in rows
    ]

    if output != "json":
        return _tabular_response(
            output_format=output,
            fieldnames=[
                "return_order_id",
                "return_number",
                "status",
                "total_items",
                "total_quantity",
                "restock_items",
                "internal_repair_items",
                "external_repair_items",
                "scrap_items",
                "return_supplier_items",
                "created_at",
            ],
            rows=[item.model_dump() for item in items],
            basename="reports-returns",
        )

    return ReportReturnsResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/picking-performance", response_model=ReportPickingPerformanceResponse)
async def report_picking_performance(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
) -> ReportPickingPerformanceResponse | Response:
    _, _, start, end = _date_bounds(date_from, date_to)
    stmt = (
        select(
            PickWave.id.label("wave_id"),
            PickWave.wave_number.label("wave_number"),
            PickWave.status.label("status"),
            PickWave.created_at.label("created_at"),
            PickWave.completed_at.label("completed_at"),
            func.count(PickTask.id).label("total_tasks"),
            func.sum(case((PickTask.status == "picked", 1), else_=0)).label("picked_tasks"),
            func.sum(case((PickTask.status == "skipped", 1), else_=0)).label("skipped_tasks"),
            func.sum(case((PickTask.status == "open", 1), else_=0)).label("open_tasks"),
        )
        .join(PickTask, PickTask.pick_wave_id == PickWave.id, isouter=True)
        .where(PickWave.created_at >= start, PickWave.created_at < end)
        .group_by(PickWave.id, PickWave.wave_number, PickWave.status, PickWave.created_at, PickWave.completed_at)
    )

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(PickWave.created_at.desc(), PickWave.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    items: list[ReportPickingPerformanceRow] = []
    for row in rows:
        total_tasks = int(row.total_tasks or 0)
        picked_tasks = int(row.picked_tasks or 0)
        skipped_tasks = int(row.skipped_tasks or 0)
        open_tasks = int(row.open_tasks or 0)
        accuracy = (
            _quantize(Decimal(picked_tasks) * Decimal("100") / Decimal(total_tasks)) if total_tasks else Decimal("0")
        )
        items.append(
            ReportPickingPerformanceRow(
                wave_id=row.wave_id,
                wave_number=row.wave_number,
                status=row.status,
                total_tasks=total_tasks,
                picked_tasks=picked_tasks,
                skipped_tasks=skipped_tasks,
                open_tasks=open_tasks,
                pick_accuracy_percent=accuracy,
                created_at=row.created_at,
                completed_at=row.completed_at,
            )
        )

    if output != "json":
        return _tabular_response(
            output_format=output,
            fieldnames=[
                "wave_id",
                "wave_number",
                "status",
                "total_tasks",
                "picked_tasks",
                "skipped_tasks",
                "open_tasks",
                "pick_accuracy_percent",
                "created_at",
                "completed_at",
            ],
            rows=[item.model_dump() for item in items],
            basename="reports-picking-performance",
        )

    return ReportPickingPerformanceResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/purchase-recommendations", response_model=ReportPurchaseRecommendationResponse)
async def report_purchase_recommendations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    status_filter: str | None = Query(default=None, alias="status"),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
) -> ReportPurchaseRecommendationResponse | Response:
    stmt = select(PurchaseRecommendation)
    if status_filter:
        stmt = stmt.where(PurchaseRecommendation.status == status_filter)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = list(
        (
            await db.execute(
                stmt.order_by(PurchaseRecommendation.generated_at.desc(), PurchaseRecommendation.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )

    items = [
        ReportPurchaseRecommendationRow(
            recommendation_id=item.id,
            product_id=item.product_id,
            status=item.status,
            target_stock=item.target_stock,
            on_hand_quantity=item.on_hand_quantity,
            open_po_quantity=item.open_po_quantity,
            deficit_quantity=item.deficit_quantity,
            recommended_quantity=item.recommended_quantity,
            generated_at=item.generated_at,
        )
        for item in rows
    ]

    if output != "json":
        return _tabular_response(
            output_format=output,
            fieldnames=[
                "recommendation_id",
                "product_id",
                "status",
                "target_stock",
                "on_hand_quantity",
                "open_po_quantity",
                "deficit_quantity",
                "recommended_quantity",
                "generated_at",
            ],
            rows=[item.model_dump() for item in items],
            basename="reports-purchase-recommendations",
        )

    return ReportPurchaseRecommendationResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/kpis", response_model=ReportKpiResponse)
async def report_kpis(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
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
    current_on_hand = (await db.execute(select(func.coalesce(func.sum(Inventory.quantity), 0)))).scalar_one()
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
    alert_count = (await db.execute(select(func.count(AlertEvent.id)).where(AlertEvent.status == "open"))).scalar_one()

    pick_totals = (
        await db.execute(
            select(
                func.count(PickTask.id).label("total_tasks"),
                func.sum(case((PickTask.status == "picked", 1), else_=0)).label("picked_tasks"),
            )
            .join(PickWave, PickWave.id == PickTask.pick_wave_id)
            .where(PickWave.created_at >= start, PickWave.created_at < end)
        )
    ).one()
    pick_total_tasks = int(pick_totals.total_tasks or 0)
    pick_picked_tasks = int(pick_totals.picked_tasks or 0)
    pick_accuracy_rate = (
        _quantize(Decimal(pick_picked_tasks) * Decimal("100") / Decimal(pick_total_tasks))
        if pick_total_tasks
        else Decimal("0.00")
    )

    returns_count = (
        await db.execute(
            select(func.count(ReturnOrder.id)).where(
                ReturnOrder.created_at >= start,
                ReturnOrder.created_at < end,
            )
        )
    ).scalar_one()
    outbound_documents = (
        await db.execute(
            select(func.count(func.distinct(StockMovement.reference_number))).where(
                StockMovement.movement_type == "goods_issue",
                StockMovement.performed_at >= start,
                StockMovement.performed_at < end,
            )
        )
    ).scalar_one()
    returns_rate = (
        _quantize(Decimal(returns_count) * Decimal("100") / Decimal(outbound_documents))
        if outbound_documents
        else Decimal("0.00")
    )

    approval_rows = (
        await db.execute(
            select(ApprovalRequest.requested_at, ApprovalRequest.decided_at).where(
                ApprovalRequest.decided_at.is_not(None),
                ApprovalRequest.decided_at >= start,
                ApprovalRequest.decided_at < end,
            )
        )
    ).all()
    approval_cycle_values = [
        Decimal((row.decided_at - row.requested_at).total_seconds()) / Decimal("3600")
        for row in approval_rows
        if row.decided_at and row.requested_at
    ]
    approval_cycle_hours = (
        _quantize(sum(approval_cycle_values) / Decimal(len(approval_cycle_values)))
        if approval_cycle_values
        else Decimal("0.00")
    )
    transit_stats = (
        await db.execute(
            select(
                func.count(func.distinct(InterWarehouseTransfer.id)).label("transfers"),
                func.coalesce(
                    func.sum(
                        InterWarehouseTransferItem.dispatched_quantity - InterWarehouseTransferItem.received_quantity
                    ),
                    0,
                ).label("transit_quantity"),
            )
            .select_from(InterWarehouseTransfer)
            .join(
                InterWarehouseTransferItem,
                InterWarehouseTransferItem.inter_warehouse_transfer_id == InterWarehouseTransfer.id,
                isouter=True,
            )
            .where(InterWarehouseTransfer.status == "dispatched")
        )
    ).one()

    return ReportKpiResponse(
        date_from=start_day,
        date_to=end_day,
        turnover_rate=turnover_rate,
        dock_to_stock_hours=dock_to_stock_hours,
        inventory_accuracy_percent=accuracy_payload.overall_accuracy_percent,
        alert_count=alert_count,
        pick_accuracy_rate=pick_accuracy_rate,
        returns_rate=returns_rate,
        approval_cycle_hours=approval_cycle_hours,
        inter_warehouse_transfers_in_transit=int(transit_stats.transfers or 0),
        inter_warehouse_transit_quantity=Decimal(transit_stats.transit_quantity or 0),
    )
