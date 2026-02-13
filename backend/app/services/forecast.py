from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Product
from app.models.inventory import StockMovement
from app.models.phase4 import ForecastItem, ForecastRun
from app.models.warehouse import BinLocation, WarehouseZone


def _quantize(value: Decimal, digits: str = "0.001") -> Decimal:
    return value.quantize(Decimal(digits), rounding=ROUND_HALF_UP)


def _date_bounds(date_from: date | None, date_to: date | None) -> tuple[date, date, datetime, datetime]:
    today = datetime.now(UTC).date()
    end_day = date_to or today
    start_day = date_from or (end_day - timedelta(days=55))
    if end_day < start_day:
        raise ValueError("date_to must be greater than or equal to date_from")
    start = datetime.combine(start_day, time.min, tzinfo=UTC)
    end = datetime.combine(end_day + timedelta(days=1), time.min, tzinfo=UTC)
    return start_day, end_day, start, end


def _mean(values: list[Decimal]) -> Decimal:
    if not values:
        return Decimal("0")
    return sum(values) / Decimal(len(values))


def _daily_series(day_map: dict[date, Decimal], *, start_day: date, end_day: date) -> list[Decimal]:
    out: list[Decimal] = []
    cursor = start_day
    while cursor <= end_day:
        out.append(day_map.get(cursor, Decimal("0")))
        cursor += timedelta(days=1)
    return out


def _confidence_score(values: list[Decimal]) -> Decimal:
    if not values:
        return Decimal("0")
    history_days = Decimal(len(values))
    non_zero_days = Decimal(sum(1 for value in values if value > 0))
    coverage = min(Decimal("1"), history_days / Decimal("56"))
    non_zero_ratio = non_zero_days / history_days if history_days > 0 else Decimal("0")
    score = (coverage * Decimal("70")) + (non_zero_ratio * Decimal("30"))
    return _quantize(score, "0.01")


def _forecast_for_horizon(*, sma: Decimal, trend_slope: Decimal, horizon_days: int) -> Decimal:
    projected_daily = max(Decimal("0"), sma + (trend_slope * Decimal(horizon_days)))
    return _quantize(projected_daily * Decimal(horizon_days))


async def recompute_demand_forecast(
    db: AsyncSession,
    *,
    generated_by: int | None,
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
) -> tuple[ForecastRun, int]:
    start_day, end_day, start, end = _date_bounds(date_from, date_to)

    movement_stmt = (
        select(
            StockMovement.product_id,
            func.date(StockMovement.performed_at).label("day"),
            func.coalesce(func.sum(StockMovement.quantity), 0).label("qty"),
        )
        .where(
            StockMovement.movement_type == "goods_issue",
            StockMovement.performed_at >= start,
            StockMovement.performed_at < end,
        )
        .group_by(StockMovement.product_id, func.date(StockMovement.performed_at))
    )
    if warehouse_id is not None:
        movement_stmt = movement_stmt.join(BinLocation, BinLocation.id == StockMovement.from_bin_id).join(
            WarehouseZone,
            WarehouseZone.id == BinLocation.zone_id,
        )
        movement_stmt = movement_stmt.where(WarehouseZone.warehouse_id == warehouse_id)

    rows = (await db.execute(movement_stmt)).all()
    if not rows:
        run = ForecastRun(
            date_from=start_day,
            date_to=end_day,
            lookback_days=(end_day - start_day).days + 1,
            horizon_days_json=[7, 30, 90],
            generated_by=generated_by,
            notes="No movement data in selected window",
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        return run, 0

    per_product: dict[int, dict[date, Decimal]] = {}
    for row in rows:
        day_value = row.day
        if isinstance(day_value, str):
            resolved_day = date.fromisoformat(day_value)
        else:
            resolved_day = day_value
        product_map = per_product.setdefault(int(row.product_id), {})
        product_map[resolved_day] = Decimal(row.qty)

    product_ids = sorted(per_product.keys())
    products = list((await db.execute(select(Product).where(Product.id.in_(product_ids)))).scalars())
    product_map = {product.id: product for product in products}

    run = ForecastRun(
        date_from=start_day,
        date_to=end_day,
        lookback_days=(end_day - start_day).days + 1,
        horizon_days_json=[7, 30, 90],
        generated_by=generated_by,
        notes=None,
    )
    db.add(run)
    await db.flush()

    created = 0
    for product_id in product_ids:
        if product_id not in product_map:
            continue
        day_map = per_product[product_id]
        values = _daily_series(day_map, start_day=start_day, end_day=end_day)
        history_days_used = len(values)

        historical_mean = _quantize(_mean(values))
        sma_values = values[-28:] if len(values) >= 28 else values
        sma = _mean(sma_values)

        last_window = values[-14:] if len(values) >= 14 else values
        previous_window = values[-28:-14] if len(values) >= 28 else []
        last_avg = _mean(last_window)
        prev_avg = _mean(previous_window)
        trend_slope = _quantize((last_avg - prev_avg) / Decimal("14"), "0.000001") if previous_window else Decimal("0")

        forecast_7 = _forecast_for_horizon(sma=sma, trend_slope=trend_slope, horizon_days=7)
        forecast_30 = _forecast_for_horizon(sma=sma, trend_slope=trend_slope, horizon_days=30)
        forecast_90 = _forecast_for_horizon(sma=sma, trend_slope=trend_slope, horizon_days=90)

        db.add(
            ForecastItem(
                run_id=run.id,
                product_id=product_id,
                warehouse_id=warehouse_id,
                historical_mean=historical_mean,
                trend_slope=trend_slope,
                confidence_score=_confidence_score(values),
                history_days_used=history_days_used,
                forecast_qty_7=forecast_7,
                forecast_qty_30=forecast_30,
                forecast_qty_90=forecast_90,
                metadata_json={
                    "sma_28": str(_quantize(sma)),
                    "last_window_avg": str(_quantize(last_avg)),
                    "previous_window_avg": str(_quantize(prev_avg)),
                },
            )
        )
        created += 1

    await db.commit()
    await db.refresh(run)
    return run, created
