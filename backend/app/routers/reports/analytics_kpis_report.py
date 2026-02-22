from .common import *


@router.get("/kpis", response_model=ReportKpiResponse)
async def report_kpis(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    include_extended: bool = Query(default=True),
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

    accuracy_totals = (
        await db.execute(
            select(
                func.sum(case((InventoryCountItem.counted_quantity.is_not(None), 1), else_=0)).label("counted_items"),
                func.sum(case((InventoryCountItem.difference_quantity == 0, 1), else_=0)).label("exact_match_items"),
            )
            .select_from(InventoryCountSession)
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
        )
    ).one()
    counted_items = int(accuracy_totals.counted_items or 0)
    exact_match_items = int(accuracy_totals.exact_match_items or 0)
    inventory_accuracy_percent = (
        _quantize(Decimal(exact_match_items) * Decimal("100") / Decimal(counted_items))
        if counted_items
        else Decimal("0.00")
    )
    alert_count = (await db.execute(select(func.count(AlertEvent.id)).where(AlertEvent.status == "open"))).scalar_one()

    pick_accuracy_rate = Decimal("0.00")
    returns_rate = Decimal("0.00")
    approval_cycle_hours = Decimal("0.00")
    inter_warehouse_transfers_in_transit = 0
    inter_warehouse_transit_quantity = Decimal("0")

    if include_extended:
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
                            InterWarehouseTransferItem.dispatched_quantity
                            - InterWarehouseTransferItem.received_quantity
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
        inter_warehouse_transfers_in_transit = int(transit_stats.transfers or 0)
        inter_warehouse_transit_quantity = Decimal(transit_stats.transit_quantity or 0)

    return ReportKpiResponse(
        date_from=start_day,
        date_to=end_day,
        turnover_rate=turnover_rate,
        dock_to_stock_hours=dock_to_stock_hours,
        inventory_accuracy_percent=inventory_accuracy_percent,
        alert_count=alert_count,
        pick_accuracy_rate=pick_accuracy_rate,
        returns_rate=returns_rate,
        approval_cycle_hours=approval_cycle_hours,
        inter_warehouse_transfers_in_transit=inter_warehouse_transfers_in_transit,
        inter_warehouse_transit_quantity=inter_warehouse_transit_quantity,
    )
