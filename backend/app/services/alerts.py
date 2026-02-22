from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_CEILING, Decimal
from secrets import token_hex

from sqlalchemy import Select, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerts import AlertEvent, AlertRule
from app.models.catalog import Product, ProductSupplier, ProductWarehouseSetting
from app.models.inventory import Inventory, InventoryBatch
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone


@dataclass(slots=True)
class AlertCandidate:
    rule_id: int
    alert_type: str
    severity: str
    title: str
    message: str
    source_key: str
    product_id: int | None
    warehouse_id: int | None
    bin_location_id: int | None
    batch_id: int | None
    metadata_json: dict | None
    dedupe_window_minutes: int


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_purchase_order_number() -> str:
    return f"PO-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _round_up_to_multiple(value: Decimal, multiple: Decimal) -> Decimal:
    if value <= 0:
        return Decimal("0")
    if multiple <= 0:
        return value
    units = (value / multiple).to_integral_value(rounding=ROUND_CEILING)
    return units * multiple


async def _preferred_supplier_for_product(db: AsyncSession, product_id: int) -> tuple[int | None, Decimal]:
    relation = (
        await db.execute(
            select(ProductSupplier)
            .where(ProductSupplier.product_id == product_id)
            .order_by(ProductSupplier.is_preferred.desc(), ProductSupplier.id.asc())
        )
    ).scalars().first()
    if relation is None:
        return None, Decimal("1")
    min_order_quantity = Decimal(relation.min_order_quantity or 1)
    if min_order_quantity <= 0:
        min_order_quantity = Decimal("1")
    return relation.supplier_id, min_order_quantity


async def _open_purchase_order_quantity_for_product(db: AsyncSession, product_id: int) -> Decimal:
    value = (
        await db.execute(
            select(func.coalesce(func.sum(PurchaseOrderItem.ordered_quantity - PurchaseOrderItem.received_quantity), 0))
            .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
            .where(
                PurchaseOrderItem.product_id == product_id,
                PurchaseOrder.status.in_(["draft", "approved", "ordered", "partially_received"]),
            )
        )
    ).scalar_one()
    return Decimal(value or 0)


async def _create_prefilled_purchase_order_for_low_stock(
    db: AsyncSession,
    *,
    candidate: AlertCandidate,
) -> int | None:
    if candidate.alert_type != "low_stock" or candidate.product_id is None:
        return None

    threshold_value = Decimal(str((candidate.metadata_json or {}).get("threshold") or "0"))
    on_hand_value = Decimal(str((candidate.metadata_json or {}).get("on_hand") or "0"))
    deficit = threshold_value - on_hand_value
    if deficit <= 0:
        return None

    open_po_quantity = await _open_purchase_order_quantity_for_product(db, candidate.product_id)
    if open_po_quantity >= deficit:
        return None

    remaining_quantity = deficit - open_po_quantity
    supplier_id, min_order_quantity = await _preferred_supplier_for_product(db, candidate.product_id)
    order_quantity = _round_up_to_multiple(remaining_quantity, min_order_quantity)
    if order_quantity <= 0:
        return None

    purchase_order = PurchaseOrder(
        order_number=_generate_purchase_order_number(),
        supplier_id=supplier_id,
        status="draft",
        created_by=None,
        notes=(
            "Auto-vorgefertigt wegen Low-Stock-Alert "
            f"{candidate.source_key} (on_hand={on_hand_value}, threshold={threshold_value})."
        ),
    )
    db.add(purchase_order)
    await db.flush()

    db.add(
        PurchaseOrderItem(
            purchase_order_id=purchase_order.id,
            product_id=candidate.product_id,
            ordered_quantity=order_quantity,
            received_quantity=0,
            unit="piece",
            unit_price=None,
        )
    )
    return purchase_order.id


def _base_stock_stmt(rule: AlertRule, *, scoped_product_ids: set[int] | None) -> Select:
    stock_sub = (
        select(
            Inventory.product_id.label("product_id"),
            WarehouseZone.warehouse_id.label("warehouse_id"),
            func.sum(Inventory.quantity).label("on_hand"),
        )
        .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
        .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
        .group_by(Inventory.product_id, WarehouseZone.warehouse_id)
        .subquery()
    )

    threshold_expr = func.coalesce(ProductWarehouseSetting.reorder_point, ProductWarehouseSetting.min_stock)
    on_hand_expr = func.coalesce(stock_sub.c.on_hand, literal(0))

    stmt = (
        select(
            ProductWarehouseSetting.product_id.label("product_id"),
            Product.product_number.label("product_number"),
            Product.name.label("product_name"),
            ProductWarehouseSetting.warehouse_id.label("warehouse_id"),
            Warehouse.code.label("warehouse_code"),
            on_hand_expr.label("on_hand"),
            threshold_expr.label("threshold"),
        )
        .join(Product, Product.id == ProductWarehouseSetting.product_id)
        .join(Warehouse, Warehouse.id == ProductWarehouseSetting.warehouse_id)
        .outerjoin(
            stock_sub,
            (stock_sub.c.product_id == ProductWarehouseSetting.product_id)
            & (stock_sub.c.warehouse_id == ProductWarehouseSetting.warehouse_id),
        )
    )

    if rule.product_id is not None:
        stmt = stmt.where(ProductWarehouseSetting.product_id == rule.product_id)
    if rule.warehouse_id is not None:
        stmt = stmt.where(ProductWarehouseSetting.warehouse_id == rule.warehouse_id)
    if scoped_product_ids:
        stmt = stmt.where(ProductWarehouseSetting.product_id.in_(scoped_product_ids))

    return stmt.order_by(ProductWarehouseSetting.product_id.asc(), ProductWarehouseSetting.warehouse_id.asc())


async def _evaluate_low_or_zero_stock_rule(
    db: AsyncSession,
    rule: AlertRule,
    *,
    scoped_product_ids: set[int] | None,
) -> list[AlertCandidate]:
    rows = (await db.execute(_base_stock_stmt(rule, scoped_product_ids=scoped_product_ids))).all()
    candidates: list[AlertCandidate] = []

    for row in rows:
        on_hand = Decimal(row.on_hand or 0)
        threshold_setting = Decimal(row.threshold) if row.threshold is not None else None
        threshold = Decimal(rule.threshold_quantity) if rule.threshold_quantity is not None else threshold_setting

        if rule.rule_type == "low_stock":
            if threshold is None or threshold <= 0:
                continue
            if on_hand <= 0 or on_hand >= threshold:
                continue

            source_key = f"low_stock:{rule.id}:{row.product_id}:{row.warehouse_id}"
            candidates.append(
                AlertCandidate(
                    rule_id=rule.id,
                    alert_type="low_stock",
                    severity=rule.severity,
                    title=f"Low stock: {row.product_number} in {row.warehouse_code}",
                    message=(
                        f"Product {row.product_number} ({row.product_name}) is below threshold "
                        f"in warehouse {row.warehouse_code}: on_hand={on_hand}, threshold={threshold}."
                    ),
                    source_key=source_key,
                    product_id=row.product_id,
                    warehouse_id=row.warehouse_id,
                    bin_location_id=None,
                    batch_id=None,
                    metadata_json={
                        "on_hand": str(on_hand),
                        "threshold": str(threshold),
                    },
                    dedupe_window_minutes=int(rule.dedupe_window_minutes),
                )
            )
            continue

        if rule.rule_type == "zero_stock":
            if on_hand > 0:
                continue

            source_key = f"zero_stock:{rule.id}:{row.product_id}:{row.warehouse_id}"
            candidates.append(
                AlertCandidate(
                    rule_id=rule.id,
                    alert_type="zero_stock",
                    severity=rule.severity,
                    title=f"Zero stock: {row.product_number} in {row.warehouse_code}",
                    message=(
                        f"Product {row.product_number} ({row.product_name}) has zero stock "
                        f"in warehouse {row.warehouse_code}."
                    ),
                    source_key=source_key,
                    product_id=row.product_id,
                    warehouse_id=row.warehouse_id,
                    bin_location_id=None,
                    batch_id=None,
                    metadata_json={
                        "on_hand": str(on_hand),
                    },
                    dedupe_window_minutes=int(rule.dedupe_window_minutes),
                )
            )

    return candidates


async def _evaluate_expiry_window_rule(
    db: AsyncSession,
    rule: AlertRule,
    *,
    scoped_product_ids: set[int] | None,
) -> list[AlertCandidate]:
    expiry_days = int(rule.expiry_days or 30)
    today = _now().date()
    window_end = today + timedelta(days=expiry_days)

    stmt = (
        select(
            InventoryBatch.id.label("batch_id"),
            InventoryBatch.product_id.label("product_id"),
            Product.product_number.label("product_number"),
            Product.name.label("product_name"),
            InventoryBatch.bin_location_id.label("bin_location_id"),
            WarehouseZone.warehouse_id.label("warehouse_id"),
            Warehouse.code.label("warehouse_code"),
            InventoryBatch.batch_number.label("batch_number"),
            InventoryBatch.expiry_date.label("expiry_date"),
            InventoryBatch.quantity.label("quantity"),
        )
        .join(Product, Product.id == InventoryBatch.product_id)
        .join(BinLocation, BinLocation.id == InventoryBatch.bin_location_id)
        .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
        .join(Warehouse, Warehouse.id == WarehouseZone.warehouse_id)
        .where(InventoryBatch.quantity > 0)
        .where(InventoryBatch.expiry_date.is_not(None))
        .where(InventoryBatch.expiry_date <= window_end)
    )

    if rule.product_id is not None:
        stmt = stmt.where(InventoryBatch.product_id == rule.product_id)
    if rule.warehouse_id is not None:
        stmt = stmt.where(WarehouseZone.warehouse_id == rule.warehouse_id)
    if scoped_product_ids:
        stmt = stmt.where(InventoryBatch.product_id.in_(scoped_product_ids))

    rows = (await db.execute(stmt.order_by(InventoryBatch.expiry_date.asc(), InventoryBatch.id.asc()))).all()

    candidates: list[AlertCandidate] = []
    for row in rows:
        expiry_date_value: date = row.expiry_date
        days_to_expiry = (expiry_date_value - today).days
        source_key = f"expiry_window:{rule.id}:{row.batch_id}"
        candidates.append(
            AlertCandidate(
                rule_id=rule.id,
                alert_type="expiry_window",
                severity=rule.severity,
                title=f"Batch expiry: {row.product_number} / {row.batch_number}",
                message=(
                    f"Batch {row.batch_number} for product {row.product_number} ({row.product_name}) "
                    f"in warehouse {row.warehouse_code} expires on {expiry_date_value.isoformat()} "
                    f"({days_to_expiry} days)."
                ),
                source_key=source_key,
                product_id=row.product_id,
                warehouse_id=row.warehouse_id,
                bin_location_id=row.bin_location_id,
                batch_id=row.batch_id,
                metadata_json={
                    "batch_number": row.batch_number,
                    "expiry_date": expiry_date_value.isoformat(),
                    "days_to_expiry": days_to_expiry,
                    "quantity": str(row.quantity),
                },
                dedupe_window_minutes=int(rule.dedupe_window_minutes),
            )
        )

    return candidates


async def _is_duplicate_candidate(db: AsyncSession, candidate: AlertCandidate) -> bool:
    open_exists = (
        await db.execute(
            select(AlertEvent.id).where(
                AlertEvent.rule_id == candidate.rule_id,
                AlertEvent.alert_type == candidate.alert_type,
                AlertEvent.source_key == candidate.source_key,
                AlertEvent.status == "open",
            ).limit(1)
        )
    ).scalar_one_or_none()
    if open_exists is not None:
        return True

    window_start = _now() - timedelta(minutes=candidate.dedupe_window_minutes)
    recent_exists = (
        await db.execute(
            select(AlertEvent.id).where(
                AlertEvent.rule_id == candidate.rule_id,
                AlertEvent.alert_type == candidate.alert_type,
                AlertEvent.source_key == candidate.source_key,
                AlertEvent.triggered_at >= window_start,
            ).limit(1)
        )
    ).scalar_one_or_none()
    return recent_exists is not None


async def evaluate_alerts(
    db: AsyncSession,
    *,
    trigger: str,
    scoped_product_ids: set[int] | None = None,
    auto_commit: bool = False,
) -> int:
    rules = list(
        (
            await db.execute(
                select(AlertRule)
                .where(AlertRule.is_active.is_(True))
                .order_by(AlertRule.id.asc())
            )
        ).scalars()
    )
    if not rules:
        return 0

    created_count = 0

    for rule in rules:
        if rule.rule_type in {"low_stock", "zero_stock"}:
            candidates = await _evaluate_low_or_zero_stock_rule(
                db,
                rule,
                scoped_product_ids=scoped_product_ids,
            )
        elif rule.rule_type == "expiry_window":
            candidates = await _evaluate_expiry_window_rule(
                db,
                rule,
                scoped_product_ids=scoped_product_ids,
            )
        else:
            continue

        for candidate in candidates:
            if await _is_duplicate_candidate(db, candidate):
                continue

            prefilled_purchase_order_id = await _create_prefilled_purchase_order_for_low_stock(
                db,
                candidate=candidate,
            )

            db.add(
                AlertEvent(
                    rule_id=candidate.rule_id,
                    alert_type=candidate.alert_type,
                    severity=candidate.severity,
                    status="open",
                    title=candidate.title,
                    message=candidate.message,
                    source_key=candidate.source_key,
                    product_id=candidate.product_id,
                    warehouse_id=candidate.warehouse_id,
                    bin_location_id=candidate.bin_location_id,
                    batch_id=candidate.batch_id,
                    triggered_at=_now(),
                    metadata_json={
                        "trigger": trigger,
                        "prefilled_purchase_order_id": prefilled_purchase_order_id,
                        **(candidate.metadata_json or {}),
                    },
                )
            )
            created_count += 1

    if created_count and auto_commit:
        await db.commit()

    return created_count
