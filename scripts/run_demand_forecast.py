#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import AsyncSessionLocal
from app.services.forecast import recompute_demand_forecast


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DirectStock demand forecast recomputation")
    parser.add_argument("--date-from", type=date.fromisoformat, default=None)
    parser.add_argument("--date-to", type=date.fromisoformat, default=None)
    parser.add_argument("--warehouse-id", type=int, default=None)
    return parser.parse_args()


async def _run(args: argparse.Namespace) -> int:
    async with AsyncSessionLocal() as session:
        run, items = await recompute_demand_forecast(
            session,
            generated_by=None,
            date_from=args.date_from,
            date_to=args.date_to,
            warehouse_id=args.warehouse_id,
        )

    print(
        "Demand forecast completed",
        f"run_id={run.id}",
        f"date_from={run.date_from}",
        f"date_to={run.date_to}",
        f"items={items}",
    )
    return 0


def main() -> int:
    args = parse_args()
    try:
        return asyncio.run(_run(args))
    except Exception as exc:  # pragma: no cover - defensive
        print(f"Demand forecast failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
