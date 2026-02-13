#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.bootstrap import seed_defaults
from app.database import AsyncSessionLocal


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="DirectStock deterministic seed runner")
    parser.add_argument(
        "--mode",
        choices=["mvp", "auth"],
        default="mvp",
        help="mvp seeds full phase-1 baseline, auth seeds only roles/users",
    )
    parser.add_argument(
        "--inventory-products",
        type=int,
        default=20,
        help="number of products seeded with initial inventory entries (deterministic from DS-ART-0001)",
    )
    parser.add_argument("--quiet", action="store_true", help="suppress final seed summary output")
    return parser.parse_args()


async def _run() -> None:
    args = parse_args()
    include_mvp = args.mode == "mvp"

    async with AsyncSessionLocal() as session:
        await seed_defaults(
            session,
            include_mvp=include_mvp,
            inventory_seed_size=max(0, args.inventory_products),
        )

    if not args.quiet:
        print(
            "Seed completed",
            f"mode={args.mode}",
            f"inventory_products={max(0, args.inventory_products) if include_mvp else 0}",
        )


if __name__ == "__main__":
    os.environ.setdefault("PYTHONPATH", str(BACKEND_DIR))
    asyncio.run(_run())
