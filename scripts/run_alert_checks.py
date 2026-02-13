#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import AsyncSessionLocal
from app.services.alerts import evaluate_alerts


async def run() -> int:
    async with AsyncSessionLocal() as session:
        created = await evaluate_alerts(
            session,
            trigger="scheduled_daily_check",
            auto_commit=True,
        )
    print(f"Alert check completed: created={created}")
    return 0


def main() -> int:
    try:
        return asyncio.run(run())
    except Exception as exc:  # pragma: no cover - defensive path
        print(f"Alert check failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
