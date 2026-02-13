#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from sqlalchemy import func, select

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import AsyncSessionLocal
from app.models.catalog import Product
from app.models.inventory import StockMovement
from app.models.phase3 import AbcClassificationItem, AbcClassificationRun


def _quantize(value: Decimal, digits: str = "0.01") -> Decimal:
    return value.quantize(Decimal(digits), rounding=ROUND_HALF_UP)


async def run() -> int:
    date_to = datetime.now(UTC).date()
    date_from = date_to - timedelta(days=89)
    start = datetime.combine(date_from, datetime.min.time(), tzinfo=UTC)
    end = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=UTC)

    async with AsyncSessionLocal() as session:
        rows = list(
            (
                await session.execute(
                    select(
                        Product.id.label("product_id"),
                        func.coalesce(func.sum(StockMovement.quantity), 0).label("outbound_quantity"),
                    )
                    .join(StockMovement, StockMovement.product_id == Product.id)
                    .where(
                        StockMovement.movement_type == "goods_issue",
                        StockMovement.performed_at >= start,
                        StockMovement.performed_at < end,
                    )
                    .group_by(Product.id)
                    .order_by(func.sum(StockMovement.quantity).desc(), Product.id.asc())
                )
            ).all()
        )

        total_outbound = sum(Decimal(row.outbound_quantity or 0) for row in rows)

        run_item = AbcClassificationRun(
            date_from=date_from,
            date_to=date_to,
            total_outbound_quantity=total_outbound,
            generated_by=None,
            generated_at=datetime.now(UTC),
        )
        session.add(run_item)
        await session.flush()

        cumulative = Decimal("0")
        for index, row in enumerate(rows, start=1):
            outbound_quantity = Decimal(row.outbound_quantity or 0)
            share = (
                _quantize(outbound_quantity * Decimal("100") / total_outbound)
                if total_outbound > 0
                else Decimal("0")
            )
            cumulative = _quantize(cumulative + share)
            category = "A" if cumulative <= Decimal("80.00") else "B" if cumulative <= Decimal("95.00") else "C"

            session.add(
                AbcClassificationItem(
                    run_id=run_item.id,
                    rank=index,
                    product_id=row.product_id,
                    outbound_quantity=outbound_quantity,
                    share_percent=share,
                    cumulative_share_percent=cumulative,
                    category=category,
                )
            )

        await session.commit()

    print(f"ABC classification completed: run_id={run_item.id}, items={len(rows)}")
    return 0


def main() -> int:
    try:
        return asyncio.run(run())
    except Exception as exc:  # pragma: no cover - defensive path
        print(f"ABC classification failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
