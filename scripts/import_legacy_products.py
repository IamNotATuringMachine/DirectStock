#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import csv
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.catalog import Product, ProductGroup

REQUIRED_COLUMNS = ("product_number", "name", "unit", "status", "product_group")
VALID_STATUSES = {"active", "blocked", "deprecated", "archived"}
DEFAULT_SOURCE = Path(
    os.getenv(
        "LEGACY_PRODUCTS_CSV_PATH",
        "/Users/tobiasmorixbauer/Documents/GitHub/LLMRAG/ab_db_data/data/csv/products.csv",
    )
)
DEFAULT_BATCH_SIZE = int(os.getenv("LEGACY_IMPORT_BATCH_SIZE", "200"))


class LegacyImportValidationError(Exception):
    pass


@dataclass(slots=True)
class ImportRow:
    product_number: str
    name: str
    description: str | None
    unit: str
    status: str
    product_group: str


@dataclass(slots=True)
class ImportSummary:
    processed: int
    created: int
    updated: int
    groups_created: int
    dry_run: bool


def _positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be > 0")
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import legacy products into DirectStock (idempotent upsert)")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="CSV source path")
    parser.add_argument("--batch-size", type=_positive_int, default=max(1, DEFAULT_BATCH_SIZE), help="batch size")
    parser.add_argument("--limit", type=_positive_int, default=None, help="max number of rows to process")
    parser.add_argument("--dry-run", action="store_true", help="validate and simulate import without writes")
    return parser.parse_args()


def _parse_row(raw_row: dict[str, str], row_number: int) -> ImportRow:
    product_number = (raw_row.get("product_number") or "").strip()
    name = (raw_row.get("name") or "").strip()
    unit = (raw_row.get("unit") or "").strip()
    status = (raw_row.get("status") or "").strip().lower()
    product_group = (raw_row.get("product_group") or "").strip()
    description = (raw_row.get("description") or "").strip() or None

    missing_fields = [
        field
        for field, value in (
            ("product_number", product_number),
            ("name", name),
            ("unit", unit),
            ("status", status),
            ("product_group", product_group),
        )
        if not value
    ]
    if missing_fields:
        raise LegacyImportValidationError(
            f"invalid row {row_number}: missing values for {', '.join(missing_fields)}"
        )

    if status not in VALID_STATUSES:
        raise LegacyImportValidationError(
            f"invalid row {row_number}: unsupported status '{status}', expected one of {sorted(VALID_STATUSES)}"
        )

    return ImportRow(
        product_number=product_number,
        name=name,
        description=description,
        unit=unit,
        status=status,
        product_group=product_group,
    )


def load_rows(source: Path, *, limit: int | None = None) -> list[ImportRow]:
    if not source.exists():
        raise FileNotFoundError(f"source file not found: {source}")

    with source.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        headers = reader.fieldnames or []

        missing_columns = [column for column in REQUIRED_COLUMNS if column not in headers]
        if missing_columns:
            raise LegacyImportValidationError(
                "legacy csv schema mismatch: missing required columns "
                f"{', '.join(missing_columns)}; got columns {', '.join(headers) or '<none>'}"
            )

        rows: list[ImportRow] = []
        for row_index, raw_row in enumerate(reader, start=2):
            rows.append(_parse_row(raw_row, row_index))
            if limit is not None and len(rows) >= limit:
                break

    return rows


def batched(rows: list[ImportRow], batch_size: int) -> Iterable[list[ImportRow]]:
    for index in range(0, len(rows), batch_size):
        yield rows[index : index + batch_size]


async def run_import(rows: list[ImportRow], *, batch_size: int, dry_run: bool) -> ImportSummary:
    created = 0
    updated = 0
    groups_created = 0

    async with AsyncSessionLocal() as session:
        group_map: dict[str, ProductGroup | None] = {
            group.name: group
            for group in (await session.execute(select(ProductGroup))).scalars()
        }

        for batch in batched(rows, batch_size):
            product_numbers = [row.product_number for row in batch]
            existing_products = {
                product.product_number: product
                for product in (
                    await session.execute(select(Product).where(Product.product_number.in_(product_numbers)))
                ).scalars()
            }

            for row in batch:
                group = group_map.get(row.product_group)
                if group is None and row.product_group not in group_map:
                    groups_created += 1
                    if dry_run:
                        group_map[row.product_group] = None
                    else:
                        group = ProductGroup(
                            name=row.product_group,
                            description="Imported via legacy importer",
                            is_active=True,
                        )
                        session.add(group)
                        await session.flush()
                        group_map[row.product_group] = group

                product = existing_products.get(row.product_number)
                if product is None:
                    created += 1
                    if not dry_run:
                        session.add(
                            Product(
                                product_number=row.product_number,
                                name=row.name,
                                description=row.description,
                                product_group_id=group_map[row.product_group].id if group_map[row.product_group] else None,
                                unit=row.unit,
                                status=row.status,
                            )
                        )
                    continue

                has_changes = False
                if product.name != row.name:
                    product.name = row.name
                    has_changes = True
                if product.description != row.description:
                    product.description = row.description
                    has_changes = True
                if product.unit != row.unit:
                    product.unit = row.unit
                    has_changes = True
                if product.status != row.status:
                    product.status = row.status
                    has_changes = True

                group_id = group_map[row.product_group].id if group_map[row.product_group] else product.product_group_id
                if product.product_group_id != group_id:
                    product.product_group_id = group_id
                    has_changes = True

                if has_changes:
                    updated += 1

            if not dry_run:
                await session.commit()

        if dry_run:
            await session.rollback()

    return ImportSummary(
        processed=len(rows),
        created=created,
        updated=updated,
        groups_created=groups_created,
        dry_run=dry_run,
    )


def main() -> int:
    args = parse_args()

    try:
        rows = load_rows(args.source, limit=args.limit)
        summary = asyncio.run(run_import(rows, batch_size=args.batch_size, dry_run=args.dry_run))
    except LegacyImportValidationError as exc:
        print(f"Legacy import validation failed: {exc}", file=sys.stderr)
        return 2
    except FileNotFoundError as exc:
        print(f"Legacy import failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # pragma: no cover - defensive path
        print(f"Legacy import failed unexpectedly: {exc}", file=sys.stderr)
        return 1

    mode = "dry-run" if summary.dry_run else "apply"
    print(
        "Legacy import completed",
        f"mode={mode}",
        f"processed={summary.processed}",
        f"created={summary.created}",
        f"updated={summary.updated}",
        f"groups_created={summary.groups_created}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
