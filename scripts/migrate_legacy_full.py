#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from import_legacy_products import (  # type: ignore
    DEFAULT_BATCH_SIZE,
    DEFAULT_SOURCE,
    LegacyImportValidationError,
    load_rows,
    run_import,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.auth import Role, User, user_roles
from app.models.catalog import Customer, Product, Supplier
from app.models.inventory import GoodsIssue, GoodsIssueItem
from app.models.phase4 import (
    LegacyIdMap,
    LegacyMigrationIssue,
    LegacyMigrationRun,
    LegacyRawRecord,
    LegacySupportRecord,
)
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse import BinLocation
from app.utils.security import hash_password

DOMAIN_ORDER = ["master", "transactions", "organization", "support"]

MASTER_FILE_NAMES = ("master_products.csv", "products.csv")
TRANSACTION_ORDERS_FILE = "transactions_purchase_orders.csv"
TRANSACTION_ORDER_ITEMS_FILE = "transactions_purchase_order_items.csv"
TRANSACTION_ISSUES_FILE = "transactions_goods_issues.csv"
TRANSACTION_ISSUE_ITEMS_FILE = "transactions_goods_issue_items.csv"
ORGANIZATION_USERS_FILE = "organization_users.csv"
SUPPORT_RECORDS_FILE = "support_records.csv"
KNOWN_TYPED_FILES = {
    *MASTER_FILE_NAMES,
    TRANSACTION_ORDERS_FILE,
    TRANSACTION_ORDER_ITEMS_FILE,
    TRANSACTION_ISSUES_FILE,
    TRANSACTION_ISSUE_ITEMS_FILE,
    ORGANIZATION_USERS_FILE,
    SUPPORT_RECORDS_FILE,
}
RAW_UPDATED_AT_COLUMNS = (
    "updated_at",
    "legacy_updated_at",
    "modified_at",
    "changed_at",
    "last_updated_at",
    "change_date",
)


@dataclass(slots=True)
class DomainIssue:
    issue_code: str
    message: str
    severity: str = "error"
    row_reference: str | None = None
    payload_json: dict | None = None


@dataclass(slots=True)
class DomainResult:
    processed: int = 0
    created: int = 0
    updated: int = 0
    errors: int = 0
    nullability_violations: int = 0
    fk_integrity_violations: int = 0
    dedupe_count: int = 0
    notes: str | None = None
    issues: list[DomainIssue] = field(default_factory=list)

    def add_issue(
        self,
        *,
        issue_code: str,
        message: str,
        severity: str = "error",
        row_reference: str | None = None,
        payload_json: dict | None = None,
    ) -> None:
        self.issues.append(
            DomainIssue(
                issue_code=issue_code,
                message=message,
                severity=severity,
                row_reference=row_reference,
                payload_json=payload_json,
            )
        )
        if severity == "error":
            self.errors += 1
        if issue_code.startswith("nullability_"):
            self.nullability_violations += 1
        if issue_code.startswith("fk_"):
            self.fk_integrity_violations += 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="DirectStock full legacy migration orchestrator")
    parser.add_argument("--mode", choices=["dry-run", "apply", "delta"], required=True)
    parser.add_argument(
        "--domain",
        choices=["master", "transactions", "organization", "support", "all"],
        default="all",
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--batch-size", type=int, default=max(1, DEFAULT_BATCH_SIZE))
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--since",
        type=str,
        default=None,
        help="ISO timestamp used by delta mode (rows with updated_at <= since are skipped when column exists)",
    )
    return parser.parse_args()


def _source_hint() -> str:
    return (
        "When --source points to a directory, expected files are: "
        "master_products.csv (or products.csv), "
        "transactions_purchase_orders.csv, transactions_purchase_order_items.csv, "
        "transactions_goods_issues.csv, transactions_goods_issue_items.csv, "
        "organization_users.csv, support_records.csv. "
        "All additional *.csv files are ingested into legacy_raw_records."
    )


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _parse_decimal(value: str | None, *, field_name: str) -> Decimal:
    if value is None:
        raise ValueError(f"{field_name} is required")
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} is required")
    try:
        return Decimal(normalized)
    except InvalidOperation as exc:
        raise ValueError(f"{field_name} must be a decimal value") from exc


def _parse_bool(value: str | None, *, default: bool = False) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if not normalized:
        return default
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise ValueError(f"invalid boolean value '{value}'")


def _split_values(value: str | None) -> list[str]:
    if not value:
        return []
    normalized = value.replace("|", ",").replace(";", ",")
    return [entry.strip() for entry in normalized.split(",") if entry.strip()]


def _row_ref(file_name: str, row_no: int) -> str:
    return f"{file_name}:{row_no}"


def _load_csv_rows(
    path: Path,
    *,
    required_columns: tuple[str, ...],
    limit: int | None = None,
) -> list[tuple[int, dict[str, str]]]:
    if not path.exists():
        raise LegacyImportValidationError(f"source file not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        headers = reader.fieldnames or []
        missing_columns = [column for column in required_columns if column not in headers]
        if missing_columns:
            raise LegacyImportValidationError(
                "legacy csv schema mismatch: missing required columns "
                f"{', '.join(missing_columns)} in {path.name}; got columns {', '.join(headers) or '<none>'}"
            )

        rows: list[tuple[int, dict[str, str]]] = []
        for row_no, row in enumerate(reader, start=2):
            if all(not (value or "").strip() for value in row.values()):
                continue
            rows.append((row_no, row))
            if limit is not None and len(rows) >= limit:
                break
        return rows


def _load_csv_rows_without_contract(path: Path, *, limit: int | None = None) -> list[tuple[int, dict[str, str]]]:
    if not path.exists():
        raise LegacyImportValidationError(f"source file not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        headers = reader.fieldnames or []
        if not headers:
            raise LegacyImportValidationError(f"legacy csv schema mismatch: missing header row in {path.name}")

        rows: list[tuple[int, dict[str, str]]] = []
        for row_no, row in enumerate(reader, start=2):
            if all(not (value or "").strip() for value in row.values()):
                continue
            rows.append((row_no, row))
            if limit is not None and len(rows) >= limit:
                break
        return rows


def _resolve_domain_file(args: argparse.Namespace, domain: str, file_name: str, *, required: bool = True) -> Path | None:
    source = args.source
    if source.is_dir():
        candidate = source / file_name
        if candidate.exists():
            return candidate
        if required:
            raise LegacyImportValidationError(f"missing required source file: {candidate}")
        return None

    if domain == "master":
        return source

    raise LegacyImportValidationError(
        f"domain '{domain}' requires --source directory with domain files. {_source_hint()}"
    )


def _resolve_master_source(args: argparse.Namespace, *, required: bool = True) -> Path | None:
    source = args.source
    if source.is_dir():
        for file_name in MASTER_FILE_NAMES:
            candidate = source / file_name
            if candidate.exists():
                return candidate
        if required:
            raise LegacyImportValidationError(
                f"missing required source file in {source}: one of {', '.join(MASTER_FILE_NAMES)}"
            )
        return None
    return source


def _raw_table_name(file_name: str) -> str:
    return Path(file_name).stem.lower()


def _payload_hash(payload: dict[str, str | None]) -> str:
    materialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(materialized.encode("utf-8")).hexdigest()


def _derive_raw_row_key(
    *,
    table_name: str,
    row_no: int,
    row: dict[str, str],
    fallback_counters: dict[str, int],
) -> tuple[str, str]:
    normalized = {key.lower(): (value or "").strip() for key, value in row.items()}
    preferred_columns = [
        "legacy_id",
        f"{table_name}_id",
        f"{table_name.rstrip('s')}_id",
        "id",
    ]
    preferred_columns.extend(
        sorted(
            {
                key
                for key in normalized
                if key.endswith("_id") or key.startswith("id_")
            }
        )
    )
    for column in preferred_columns:
        value = normalized.get(column) or ""
        if value:
            return value, column

    hash_value = _payload_hash({key: row.get(key) for key in sorted(row.keys())})
    occurrence = fallback_counters.get(hash_value, 0) + 1
    fallback_counters[hash_value] = occurrence
    return f"hash:{hash_value}#{occurrence}:row:{row_no}", "payload_hash"


def _infer_source_updated_at(row: dict[str, str], *, row_reference: str, result: DomainResult) -> datetime | None:
    for column in RAW_UPDATED_AT_COLUMNS:
        raw = (row.get(column) or "").strip()
        if not raw:
            continue
        try:
            return _parse_datetime(raw)
        except ValueError:
            result.add_issue(
                issue_code="validation_invalid_timestamp",
                severity="warning",
                message=f"{row_reference} has invalid {column} value '{raw}', row kept",
                row_reference=row_reference,
            )
            return None
    return None


def _merge_domain_result(target: DomainResult, source: DomainResult) -> None:
    target.processed += source.processed
    target.created += source.created
    target.updated += source.updated
    target.errors += source.errors
    target.nullability_violations += source.nullability_violations
    target.fk_integrity_violations += source.fk_integrity_violations
    target.issues.extend(source.issues)


def _filter_rows_for_delta(
    rows: list[tuple[int, dict[str, str]]],
    *,
    file_name: str,
    since_dt: datetime | None,
    result: DomainResult,
) -> list[tuple[int, dict[str, str]]]:
    if since_dt is None:
        return rows

    filtered: list[tuple[int, dict[str, str]]] = []
    missing_timestamp_count = 0
    for row_no, row in rows:
        raw = (row.get("updated_at") or row.get("legacy_updated_at") or "").strip()
        if not raw:
            missing_timestamp_count += 1
            filtered.append((row_no, row))
            continue
        try:
            updated_at = _parse_datetime(raw)
        except ValueError:
            result.add_issue(
                issue_code="validation_invalid_timestamp",
                severity="warning",
                message=f"{file_name}:{row_no} has invalid updated_at '{raw}', row kept in delta mode",
                row_reference=_row_ref(file_name, row_no),
            )
            filtered.append((row_no, row))
            continue
        if updated_at is None or updated_at > since_dt:
            filtered.append((row_no, row))

    if missing_timestamp_count:
        result.add_issue(
            issue_code="delta_missing_timestamp",
            severity="warning",
            message=f"{file_name}: {missing_timestamp_count} rows without updated_at were included",
        )
    return filtered


def _reconciliation_from_result(result: DomainResult) -> dict:
    return {
        "record_count_match": result.errors == 0,
        "nullability_violations": result.nullability_violations,
        "fk_integrity_violations": result.fk_integrity_violations,
        "dedupe_count": result.dedupe_count,
    }


async def _create_run(*, mode: str, domain: str, source_ref: str) -> LegacyMigrationRun:
    async with AsyncSessionLocal() as session:
        run = LegacyMigrationRun(
            run_type=mode,
            domain=domain,
            source_ref=source_ref,
            status="running",
            notes=None,
        )
        session.add(run)
        await session.commit()
        await session.refresh(run)
        return run


async def _complete_run(
    run_id: int,
    *,
    status: str,
    processed: int,
    created: int,
    updated: int,
    errors: int,
    reconciliation: dict,
    notes: str | None = None,
) -> None:
    async with AsyncSessionLocal() as session:
        run = (await session.execute(select(LegacyMigrationRun).where(LegacyMigrationRun.id == run_id))).scalar_one()
        run.status = status
        run.processed_records = processed
        run.created_records = created
        run.updated_records = updated
        run.error_records = errors
        run.reconciliation_json = reconciliation
        run.notes = notes
        run.finished_at = datetime.now(UTC)
        session.add(run)
        await session.commit()


async def _add_issue(
    run_id: int,
    *,
    domain: str,
    issue_code: str,
    message: str,
    severity: str = "error",
    row_reference: str | None = None,
    payload_json: dict | None = None,
) -> None:
    async with AsyncSessionLocal() as session:
        session.add(
            LegacyMigrationIssue(
                run_id=run_id,
                domain=domain,
                issue_code=issue_code,
                severity=severity,
                message=message,
                row_reference=row_reference,
                payload_json=payload_json,
            )
        )
        await session.commit()


async def _load_legacy_id_index(session: AsyncSession, *, domain: str) -> dict[tuple[str, str], LegacyIdMap]:
    rows = list(
        (
            await session.execute(
                select(LegacyIdMap).where(LegacyIdMap.domain == domain)
            )
        ).scalars()
    )
    return {(row.legacy_id, row.directstock_entity): row for row in rows}


def _upsert_legacy_id_map(
    *,
    index: dict[tuple[str, str], LegacyIdMap],
    session: AsyncSession,
    domain: str,
    legacy_id: str,
    directstock_entity: str,
    directstock_id: int,
    run_id: int,
) -> None:
    key = (legacy_id, directstock_entity)
    mapped = index.get(key)
    if mapped is None:
        mapped = LegacyIdMap(
            domain=domain,
            legacy_id=legacy_id,
            directstock_entity=directstock_entity,
            directstock_id=directstock_id,
            run_id=run_id,
        )
        session.add(mapped)
        index[key] = mapped
        return

    mapped.directstock_id = directstock_id
    mapped.run_id = run_id


async def _run_master_domain(args: argparse.Namespace, mode: str, *, run_id: int) -> DomainResult:
    result = DomainResult()
    source = _resolve_master_source(args, required=not args.source.is_dir())
    if source is None:
        result.add_issue(
            issue_code="domain_source_missing",
            severity="warning",
            message=(
                f"master domain skipped: no recognized product source file in {args.source} "
                f"(expected one of {', '.join(MASTER_FILE_NAMES)})"
            ),
        )
        return result
    rows = load_rows(source, limit=args.limit)
    summary = await run_import(
        rows,
        batch_size=args.batch_size,
        dry_run=(mode == "dry-run"),
    )

    result = DomainResult(
        processed=summary.processed,
        created=summary.created,
        updated=summary.updated,
        dedupe_count=max(0, summary.processed - summary.created - summary.updated),
    )
    if mode == "delta" and args.since:
        result.notes = f"delta_since={args.since}"

    if mode == "dry-run":
        return result

    async with AsyncSessionLocal() as session:
        legacy_index = await _load_legacy_id_index(session, domain="master")
        product_numbers = sorted({row.product_number for row in rows})
        if product_numbers:
            products = list(
                (
                    await session.execute(
                        select(Product).where(Product.product_number.in_(product_numbers))
                    )
                ).scalars()
            )
            for product in products:
                _upsert_legacy_id_map(
                    index=legacy_index,
                    session=session,
                    domain="master",
                    legacy_id=product.product_number,
                    directstock_entity="product",
                    directstock_id=product.id,
                    run_id=run_id,
                )
        await session.commit()
    return result


def _string_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


async def _run_transactions_domain(args: argparse.Namespace, mode: str, *, run_id: int) -> DomainResult:
    result = DomainResult()
    orders_file = _resolve_domain_file(
        args,
        "transactions",
        TRANSACTION_ORDERS_FILE,
        required=not args.source.is_dir(),
    )
    order_items_file = _resolve_domain_file(
        args,
        "transactions",
        TRANSACTION_ORDER_ITEMS_FILE,
        required=not args.source.is_dir(),
    )
    issues_file = _resolve_domain_file(
        args,
        "transactions",
        TRANSACTION_ISSUES_FILE,
        required=not args.source.is_dir(),
    )
    issue_items_file = _resolve_domain_file(
        args,
        "transactions",
        TRANSACTION_ISSUE_ITEMS_FILE,
        required=not args.source.is_dir(),
    )
    if None in {orders_file, order_items_file, issues_file, issue_items_file}:
        missing_files = [
            file_name
            for file_name, resolved in (
                (TRANSACTION_ORDERS_FILE, orders_file),
                (TRANSACTION_ORDER_ITEMS_FILE, order_items_file),
                (TRANSACTION_ISSUES_FILE, issues_file),
                (TRANSACTION_ISSUE_ITEMS_FILE, issue_items_file),
            )
            if resolved is None
        ]
        result.add_issue(
            issue_code="domain_source_missing",
            severity="warning",
            message=f"transactions domain skipped: missing source files: {', '.join(missing_files)}",
        )
        return result

    order_rows = _load_csv_rows(
        orders_file,
        required_columns=("legacy_id", "order_number"),
        limit=args.limit,
    )
    order_item_rows = _load_csv_rows(
        order_items_file,
        required_columns=("legacy_id", "purchase_order_legacy_id", "product_number", "ordered_quantity"),
        limit=args.limit,
    )
    issue_rows = _load_csv_rows(
        issues_file,
        required_columns=("legacy_id", "issue_number"),
        limit=args.limit,
    )
    issue_item_rows = _load_csv_rows(
        issue_items_file,
        required_columns=("legacy_id", "goods_issue_legacy_id", "product_number", "requested_quantity"),
        limit=args.limit,
    )

    order_rows = _filter_rows_for_delta(
        order_rows,
        file_name=orders_file.name,
        since_dt=args.since_dt,
        result=result,
    )
    order_item_rows = _filter_rows_for_delta(
        order_item_rows,
        file_name=order_items_file.name,
        since_dt=args.since_dt,
        result=result,
    )
    issue_rows = _filter_rows_for_delta(
        issue_rows,
        file_name=issues_file.name,
        since_dt=args.since_dt,
        result=result,
    )
    issue_item_rows = _filter_rows_for_delta(
        issue_item_rows,
        file_name=issue_items_file.name,
        since_dt=args.since_dt,
        result=result,
    )

    result.processed = len(order_rows) + len(order_item_rows) + len(issue_rows) + len(issue_item_rows)

    async with AsyncSessionLocal() as session:
        legacy_index = await _load_legacy_id_index(session, domain="transactions")

        supplier_numbers = sorted(
            {
                supplier_number.strip()
                for _, row in order_rows
                for supplier_number in [row.get("supplier_number") or ""]
                if supplier_number.strip()
            }
        )
        customer_numbers = sorted(
            {
                customer_number.strip()
                for _, row in issue_rows
                for customer_number in [row.get("customer_number") or ""]
                if customer_number.strip()
            }
        )
        product_numbers = sorted(
            {
                product_number.strip()
                for _, row in (order_item_rows + issue_item_rows)
                for product_number in [row.get("product_number") or ""]
                if product_number.strip()
            }
        )
        source_bin_codes = sorted(
            {
                source_bin_code.strip()
                for _, row in issue_item_rows
                for source_bin_code in [row.get("source_bin_code") or ""]
                if source_bin_code.strip()
            }
        )

        supplier_map = {
            item.supplier_number: item.id
            for item in (
                await session.execute(select(Supplier).where(Supplier.supplier_number.in_(supplier_numbers)))
            ).scalars()
        } if supplier_numbers else {}
        customer_map = {
            item.customer_number: item.id
            for item in (
                await session.execute(select(Customer).where(Customer.customer_number.in_(customer_numbers)))
            ).scalars()
        } if customer_numbers else {}
        product_map = {
            item.product_number: item.id
            for item in (
                await session.execute(select(Product).where(Product.product_number.in_(product_numbers)))
            ).scalars()
        } if product_numbers else {}
        bin_map = {
            item.code: item.id
            for item in (
                await session.execute(select(BinLocation).where(BinLocation.code.in_(source_bin_codes)))
            ).scalars()
        } if source_bin_codes else {}

        order_by_legacy: dict[str, PurchaseOrder] = {}
        for row_no, row in order_rows:
            legacy_id = (row.get("legacy_id") or "").strip()
            order_number = (row.get("order_number") or "").strip()
            row_reference = _row_ref(orders_file.name, row_no)
            if not legacy_id or not order_number:
                result.add_issue(
                    issue_code="nullability_missing_required",
                    message=f"{row_reference} requires legacy_id and order_number",
                    row_reference=row_reference,
                )
                continue

            mapped = legacy_index.get((legacy_id, "purchase_order"))
            order: PurchaseOrder | None = None
            if mapped is not None:
                order = await session.get(PurchaseOrder, mapped.directstock_id)
            if order is None:
                order = (
                    await session.execute(
                        select(PurchaseOrder).where(PurchaseOrder.order_number == order_number)
                    )
                ).scalar_one_or_none()

            is_created = order is None
            if is_created:
                order = PurchaseOrder(
                    order_number=order_number,
                    status="draft",
                    supplier_id=None,
                    notes=None,
                )
                session.add(order)
                result.created += 1

            changed = False
            if order.order_number != order_number:
                order.order_number = order_number
                changed = True

            supplier_number = (row.get("supplier_number") or "").strip()
            supplier_id = supplier_map.get(supplier_number) if supplier_number else None
            if supplier_number and supplier_id is None:
                result.add_issue(
                    issue_code="fk_supplier_missing",
                    severity="warning",
                    message=f"{row_reference} supplier_number '{supplier_number}' not found",
                    row_reference=row_reference,
                )
            if order.supplier_id != supplier_id:
                order.supplier_id = supplier_id
                changed = True

            status_value = (row.get("status") or "").strip() or "draft"
            if order.status != status_value:
                order.status = status_value
                changed = True

            try:
                expected_delivery_at = _parse_datetime(row.get("expected_delivery_at"))
                ordered_at = _parse_datetime(row.get("ordered_at"))
                completed_at = _parse_datetime(row.get("completed_at"))
            except ValueError as exc:
                result.add_issue(
                    issue_code="validation_invalid_datetime",
                    message=f"{row_reference} has invalid datetime: {exc}",
                    row_reference=row_reference,
                )
                continue

            if order.expected_delivery_at != expected_delivery_at:
                order.expected_delivery_at = expected_delivery_at
                changed = True
            if order.ordered_at != ordered_at:
                order.ordered_at = ordered_at
                changed = True
            if order.completed_at != completed_at:
                order.completed_at = completed_at
                changed = True

            notes = _string_or_none(row.get("notes"))
            if order.notes != notes:
                order.notes = notes
                changed = True

            if not is_created and changed:
                result.updated += 1

            await session.flush()
            _upsert_legacy_id_map(
                index=legacy_index,
                session=session,
                domain="transactions",
                legacy_id=legacy_id,
                directstock_entity="purchase_order",
                directstock_id=order.id,
                run_id=run_id,
            )
            order_by_legacy[legacy_id] = order

        issue_by_legacy: dict[str, GoodsIssue] = {}
        for row_no, row in issue_rows:
            legacy_id = (row.get("legacy_id") or "").strip()
            issue_number = (row.get("issue_number") or "").strip()
            row_reference = _row_ref(issues_file.name, row_no)
            if not legacy_id or not issue_number:
                result.add_issue(
                    issue_code="nullability_missing_required",
                    message=f"{row_reference} requires legacy_id and issue_number",
                    row_reference=row_reference,
                )
                continue

            mapped = legacy_index.get((legacy_id, "goods_issue"))
            issue: GoodsIssue | None = None
            if mapped is not None:
                issue = await session.get(GoodsIssue, mapped.directstock_id)
            if issue is None:
                issue = (
                    await session.execute(
                        select(GoodsIssue).where(GoodsIssue.issue_number == issue_number)
                    )
                ).scalar_one_or_none()

            is_created = issue is None
            if is_created:
                issue = GoodsIssue(
                    issue_number=issue_number,
                    status="draft",
                    customer_id=None,
                    customer_reference=None,
                    notes=None,
                )
                session.add(issue)
                result.created += 1

            changed = False
            if issue.issue_number != issue_number:
                issue.issue_number = issue_number
                changed = True

            customer_number = (row.get("customer_number") or "").strip()
            customer_id = customer_map.get(customer_number) if customer_number else None
            if customer_number and customer_id is None:
                result.add_issue(
                    issue_code="fk_customer_missing",
                    severity="warning",
                    message=f"{row_reference} customer_number '{customer_number}' not found",
                    row_reference=row_reference,
                )
            if issue.customer_id != customer_id:
                issue.customer_id = customer_id
                changed = True

            status_value = (row.get("status") or "").strip() or "draft"
            if issue.status != status_value:
                issue.status = status_value
                changed = True

            customer_reference = _string_or_none(row.get("customer_reference"))
            if issue.customer_reference != customer_reference:
                issue.customer_reference = customer_reference
                changed = True

            try:
                issued_at = _parse_datetime(row.get("issued_at"))
                completed_at = _parse_datetime(row.get("completed_at"))
            except ValueError as exc:
                result.add_issue(
                    issue_code="validation_invalid_datetime",
                    message=f"{row_reference} has invalid datetime: {exc}",
                    row_reference=row_reference,
                )
                continue

            if issue.issued_at != issued_at:
                issue.issued_at = issued_at
                changed = True
            if issue.completed_at != completed_at:
                issue.completed_at = completed_at
                changed = True

            notes = _string_or_none(row.get("notes"))
            if issue.notes != notes:
                issue.notes = notes
                changed = True

            if not is_created and changed:
                result.updated += 1

            await session.flush()
            _upsert_legacy_id_map(
                index=legacy_index,
                session=session,
                domain="transactions",
                legacy_id=legacy_id,
                directstock_entity="goods_issue",
                directstock_id=issue.id,
                run_id=run_id,
            )
            issue_by_legacy[legacy_id] = issue

        for row_no, row in order_item_rows:
            legacy_id = (row.get("legacy_id") or "").strip()
            order_legacy_id = (row.get("purchase_order_legacy_id") or "").strip()
            product_number = (row.get("product_number") or "").strip()
            row_reference = _row_ref(order_items_file.name, row_no)
            if not legacy_id or not order_legacy_id or not product_number:
                result.add_issue(
                    issue_code="nullability_missing_required",
                    message=f"{row_reference} requires legacy_id, purchase_order_legacy_id, product_number",
                    row_reference=row_reference,
                )
                continue

            order = order_by_legacy.get(order_legacy_id)
            if order is None:
                mapped_order = legacy_index.get((order_legacy_id, "purchase_order"))
                if mapped_order is not None:
                    order = await session.get(PurchaseOrder, mapped_order.directstock_id)
            if order is None:
                result.add_issue(
                    issue_code="fk_purchase_order_missing",
                    severity="warning" if mode == "dry-run" else "error",
                    message=f"{row_reference} references unknown purchase_order_legacy_id '{order_legacy_id}'",
                    row_reference=row_reference,
                )
                continue

            product_id = product_map.get(product_number)
            if product_id is None:
                result.add_issue(
                    issue_code="fk_product_missing",
                    severity="warning" if mode == "dry-run" else "error",
                    message=f"{row_reference} product_number '{product_number}' not found",
                    row_reference=row_reference,
                )
                continue

            try:
                ordered_quantity = _parse_decimal(row.get("ordered_quantity"), field_name="ordered_quantity")
                if ordered_quantity <= 0:
                    raise ValueError("ordered_quantity must be > 0")
                received_quantity_raw = row.get("received_quantity")
                received_quantity = (
                    _parse_decimal(received_quantity_raw, field_name="received_quantity")
                    if received_quantity_raw and received_quantity_raw.strip()
                    else Decimal("0")
                )
                unit_price_raw = row.get("unit_price")
                unit_price = (
                    _parse_decimal(unit_price_raw, field_name="unit_price")
                    if unit_price_raw and unit_price_raw.strip()
                    else None
                )
                expected_delivery_at = _parse_datetime(row.get("expected_delivery_at"))
            except ValueError as exc:
                result.add_issue(
                    issue_code="validation_invalid_value",
                    message=f"{row_reference} has invalid numeric/datetime value: {exc}",
                    row_reference=row_reference,
                )
                continue

            unit = (row.get("unit") or "").strip() or "piece"
            mapped = legacy_index.get((legacy_id, "purchase_order_item"))
            item: PurchaseOrderItem | None = None
            if mapped is not None:
                item = await session.get(PurchaseOrderItem, mapped.directstock_id)
            if item is None:
                item = (
                    await session.execute(
                        select(PurchaseOrderItem).where(
                            PurchaseOrderItem.purchase_order_id == order.id,
                            PurchaseOrderItem.product_id == product_id,
                            PurchaseOrderItem.unit == unit,
                        )
                    )
                ).scalar_one_or_none()

            is_created = item is None
            if is_created:
                item = PurchaseOrderItem(
                    purchase_order_id=order.id,
                    product_id=product_id,
                    ordered_quantity=ordered_quantity,
                    received_quantity=received_quantity,
                    unit=unit,
                    unit_price=unit_price,
                    expected_delivery_at=expected_delivery_at,
                )
                session.add(item)
                result.created += 1
            else:
                changed = False
                if item.purchase_order_id != order.id:
                    item.purchase_order_id = order.id
                    changed = True
                if item.product_id != product_id:
                    item.product_id = product_id
                    changed = True
                if item.ordered_quantity != ordered_quantity:
                    item.ordered_quantity = ordered_quantity
                    changed = True
                if item.received_quantity != received_quantity:
                    item.received_quantity = received_quantity
                    changed = True
                if item.unit != unit:
                    item.unit = unit
                    changed = True
                if item.unit_price != unit_price:
                    item.unit_price = unit_price
                    changed = True
                if item.expected_delivery_at != expected_delivery_at:
                    item.expected_delivery_at = expected_delivery_at
                    changed = True
                if changed:
                    result.updated += 1

            await session.flush()
            _upsert_legacy_id_map(
                index=legacy_index,
                session=session,
                domain="transactions",
                legacy_id=legacy_id,
                directstock_entity="purchase_order_item",
                directstock_id=item.id,
                run_id=run_id,
            )

        for row_no, row in issue_item_rows:
            legacy_id = (row.get("legacy_id") or "").strip()
            issue_legacy_id = (row.get("goods_issue_legacy_id") or "").strip()
            product_number = (row.get("product_number") or "").strip()
            row_reference = _row_ref(issue_items_file.name, row_no)
            if not legacy_id or not issue_legacy_id or not product_number:
                result.add_issue(
                    issue_code="nullability_missing_required",
                    message=f"{row_reference} requires legacy_id, goods_issue_legacy_id, product_number",
                    row_reference=row_reference,
                )
                continue

            issue = issue_by_legacy.get(issue_legacy_id)
            if issue is None:
                mapped_issue = legacy_index.get((issue_legacy_id, "goods_issue"))
                if mapped_issue is not None:
                    issue = await session.get(GoodsIssue, mapped_issue.directstock_id)
            if issue is None:
                result.add_issue(
                    issue_code="fk_goods_issue_missing",
                    severity="warning" if mode == "dry-run" else "error",
                    message=f"{row_reference} references unknown goods_issue_legacy_id '{issue_legacy_id}'",
                    row_reference=row_reference,
                )
                continue

            product_id = product_map.get(product_number)
            if product_id is None:
                result.add_issue(
                    issue_code="fk_product_missing",
                    severity="warning" if mode == "dry-run" else "error",
                    message=f"{row_reference} product_number '{product_number}' not found",
                    row_reference=row_reference,
                )
                continue

            source_bin_code = (row.get("source_bin_code") or "").strip()
            source_bin_id = bin_map.get(source_bin_code) if source_bin_code else None
            if source_bin_code and source_bin_id is None:
                result.add_issue(
                    issue_code="fk_bin_missing",
                    severity="warning",
                    message=f"{row_reference} source_bin_code '{source_bin_code}' not found",
                    row_reference=row_reference,
                )

            try:
                requested_quantity = _parse_decimal(row.get("requested_quantity"), field_name="requested_quantity")
                if requested_quantity <= 0:
                    raise ValueError("requested_quantity must be > 0")
                issued_quantity_raw = row.get("issued_quantity")
                issued_quantity = (
                    _parse_decimal(issued_quantity_raw, field_name="issued_quantity")
                    if issued_quantity_raw and issued_quantity_raw.strip()
                    else requested_quantity
                )
                use_fefo = _parse_bool(row.get("use_fefo"), default=False)
            except ValueError as exc:
                result.add_issue(
                    issue_code="validation_invalid_value",
                    message=f"{row_reference} has invalid numeric/boolean value: {exc}",
                    row_reference=row_reference,
                )
                continue

            unit = (row.get("unit") or "").strip() or "piece"
            batch_number = _string_or_none(row.get("batch_number"))
            serial_numbers = _split_values(row.get("serial_numbers"))

            mapped = legacy_index.get((legacy_id, "goods_issue_item"))
            item: GoodsIssueItem | None = None
            if mapped is not None:
                item = await session.get(GoodsIssueItem, mapped.directstock_id)
            if item is None:
                item = (
                    await session.execute(
                        select(GoodsIssueItem).where(
                            GoodsIssueItem.goods_issue_id == issue.id,
                            GoodsIssueItem.product_id == product_id,
                            GoodsIssueItem.unit == unit,
                        )
                    )
                ).scalar_one_or_none()

            is_created = item is None
            if is_created:
                item = GoodsIssueItem(
                    goods_issue_id=issue.id,
                    product_id=product_id,
                    requested_quantity=requested_quantity,
                    issued_quantity=issued_quantity,
                    unit=unit,
                    source_bin_id=source_bin_id,
                    batch_number=batch_number,
                    use_fefo=use_fefo,
                    serial_numbers=serial_numbers or None,
                )
                session.add(item)
                result.created += 1
            else:
                changed = False
                if item.goods_issue_id != issue.id:
                    item.goods_issue_id = issue.id
                    changed = True
                if item.product_id != product_id:
                    item.product_id = product_id
                    changed = True
                if item.requested_quantity != requested_quantity:
                    item.requested_quantity = requested_quantity
                    changed = True
                if item.issued_quantity != issued_quantity:
                    item.issued_quantity = issued_quantity
                    changed = True
                if item.unit != unit:
                    item.unit = unit
                    changed = True
                if item.source_bin_id != source_bin_id:
                    item.source_bin_id = source_bin_id
                    changed = True
                if item.batch_number != batch_number:
                    item.batch_number = batch_number
                    changed = True
                if item.use_fefo != use_fefo:
                    item.use_fefo = use_fefo
                    changed = True
                if (item.serial_numbers or []) != serial_numbers:
                    item.serial_numbers = serial_numbers or None
                    changed = True
                if changed:
                    result.updated += 1

            await session.flush()
            _upsert_legacy_id_map(
                index=legacy_index,
                session=session,
                domain="transactions",
                legacy_id=legacy_id,
                directstock_entity="goods_issue_item",
                directstock_id=item.id,
                run_id=run_id,
            )

        if mode == "dry-run":
            await session.rollback()
        else:
            await session.commit()

    result.dedupe_count = max(0, result.processed - result.created - result.updated - result.errors)
    if mode == "delta" and args.since:
        result.notes = f"delta_since={args.since}"
    return result


async def _run_organization_domain(args: argparse.Namespace, mode: str, *, run_id: int) -> DomainResult:
    result = DomainResult()
    users_file = _resolve_domain_file(
        args,
        "organization",
        ORGANIZATION_USERS_FILE,
        required=not args.source.is_dir(),
    )
    if users_file is None:
        result.add_issue(
            issue_code="domain_source_missing",
            severity="warning",
            message=f"organization domain skipped: missing source file {ORGANIZATION_USERS_FILE}",
        )
        return result
    user_rows = _load_csv_rows(
        users_file,
        required_columns=("legacy_id", "username"),
        limit=args.limit,
    )
    user_rows = _filter_rows_for_delta(
        user_rows,
        file_name=users_file.name,
        since_dt=args.since_dt,
        result=result,
    )
    result.processed = len(user_rows)

    async with AsyncSessionLocal() as session:
        legacy_index = await _load_legacy_id_index(session, domain="organization")
        role_map = {
            role.name: role
            for role in (await session.execute(select(Role))).scalars()
        }

        for row_no, row in user_rows:
            legacy_id = (row.get("legacy_id") or "").strip()
            username = (row.get("username") or "").strip()
            row_reference = _row_ref(users_file.name, row_no)
            if not legacy_id or not username:
                result.add_issue(
                    issue_code="nullability_missing_required",
                    message=f"{row_reference} requires legacy_id and username",
                    row_reference=row_reference,
                )
                continue

            mapped = legacy_index.get((legacy_id, "user"))
            user: User | None = None
            if mapped is not None:
                user = (
                    await session.execute(
                        select(User)
                        .options(selectinload(User.roles))
                        .where(User.id == mapped.directstock_id)
                    )
                ).scalar_one_or_none()
            if user is None:
                user = (
                    await session.execute(
                        select(User)
                        .options(selectinload(User.roles))
                        .where(User.username == username)
                    )
                ).scalar_one_or_none()

            is_created = user is None
            if is_created:
                password_seed = _string_or_none(row.get("password")) or f"Legacy-{username}-ChangeMe!"
                user = User(
                    username=username,
                    email=None,
                    full_name=None,
                    hashed_password=hash_password(password_seed),
                    is_active=True,
                )
                session.add(user)
                result.created += 1

            changed = False
            if user.username != username:
                user.username = username
                changed = True

            email = _string_or_none(row.get("email"))
            if user.email != email:
                user.email = email
                changed = True

            full_name = _string_or_none(row.get("full_name"))
            if user.full_name != full_name:
                user.full_name = full_name
                changed = True

            try:
                is_active = _parse_bool(row.get("is_active"), default=True)
            except ValueError as exc:
                result.add_issue(
                    issue_code="validation_invalid_value",
                    message=f"{row_reference} has invalid is_active value: {exc}",
                    row_reference=row_reference,
                )
                continue
            if user.is_active != is_active:
                user.is_active = is_active
                changed = True

            password_raw = _string_or_none(row.get("password"))
            if password_raw and not is_created:
                user.hashed_password = hash_password(password_raw)
                changed = True

            role_names = _split_values(row.get("roles"))
            if not role_names:
                role_names = ["lagermitarbeiter"]

            resolved_roles: list[Role] = []
            for role_name in role_names:
                role = role_map.get(role_name)
                if role is None:
                    role = Role(name=role_name, description="Imported from legacy organization data")
                    session.add(role)
                    await session.flush()
                    role_map[role_name] = role
                resolved_roles.append(role)

            await session.flush()
            desired_role_ids = sorted({role.id for role in resolved_roles})
            existing_role_ids = sorted(
                (
                    await session.execute(
                        select(user_roles.c.role_id).where(user_roles.c.user_id == user.id)
                    )
                ).scalars()
            )
            if existing_role_ids != desired_role_ids:
                await session.execute(user_roles.delete().where(user_roles.c.user_id == user.id))
                if desired_role_ids:
                    await session.execute(
                        user_roles.insert(),
                        [
                            {"user_id": user.id, "role_id": role_id}
                            for role_id in desired_role_ids
                        ],
                    )
                changed = True

            if not is_created and changed:
                result.updated += 1

            await session.flush()
            _upsert_legacy_id_map(
                index=legacy_index,
                session=session,
                domain="organization",
                legacy_id=legacy_id,
                directstock_entity="user",
                directstock_id=user.id,
                run_id=run_id,
            )

        if mode == "dry-run":
            await session.rollback()
        else:
            await session.commit()

    result.dedupe_count = max(0, result.processed - result.created - result.updated - result.errors)
    if mode == "delta" and args.since:
        result.notes = f"delta_since={args.since}"
    return result


def _parse_payload_json(raw: str | None) -> dict | None:
    value = _string_or_none(raw)
    if value is None:
        return None
    payload = json.loads(value)
    if isinstance(payload, dict):
        return payload
    return {"value": payload}


async def _run_raw_table_staging(args: argparse.Namespace, mode: str, *, run_id: int) -> DomainResult:
    result = DomainResult()
    source = args.source
    if not source.is_dir():
        return result

    known_typed_files = {name.lower() for name in KNOWN_TYPED_FILES}
    raw_files = sorted(
        file
        for file in source.iterdir()
        if file.is_file() and file.suffix.lower() == ".csv" and file.name.lower() not in known_typed_files
    )
    if not raw_files:
        return result

    async with AsyncSessionLocal() as session:
        legacy_index = await _load_legacy_id_index(session, domain="support")
        for raw_file in raw_files:
            rows = _load_csv_rows_without_contract(raw_file, limit=args.limit)
            rows = _filter_rows_for_delta(
                rows,
                file_name=raw_file.name,
                since_dt=args.since_dt,
                result=result,
            )
            result.processed += len(rows)
            if not rows:
                continue

            source_table = _raw_table_name(raw_file.name)
            existing_records = {
                row.row_key: row
                for row in (
                    await session.execute(
                        select(LegacyRawRecord).where(LegacyRawRecord.source_table == source_table)
                    )
                ).scalars()
            }
            fallback_counters: dict[str, int] = {}
            seen_keys_in_file: set[str] = set()
            for row_no, row in rows:
                row_reference = _row_ref(raw_file.name, row_no)
                payload_json = {key: row.get(key) for key in row.keys()}
                row_key, row_key_source = _derive_raw_row_key(
                    table_name=source_table,
                    row_no=row_no,
                    row=row,
                    fallback_counters=fallback_counters,
                )
                if row_key in seen_keys_in_file:
                    result.add_issue(
                        issue_code="raw_duplicate_row_key",
                        severity="warning",
                        message=(
                            f"{row_reference} duplicates row_key '{row_key}' in {raw_file.name}; "
                            "last-write-wins during import"
                        ),
                        row_reference=row_reference,
                    )
                seen_keys_in_file.add(row_key)
                row_hash = _payload_hash(payload_json)
                source_updated_at = _infer_source_updated_at(row, row_reference=row_reference, result=result)

                record = existing_records.get(row_key)
                if record is None:
                    record = LegacyRawRecord(
                        run_id=run_id,
                        source_table=source_table,
                        source_file=raw_file.name,
                        row_key=row_key,
                        row_key_source=row_key_source,
                        row_hash=row_hash,
                        source_updated_at=source_updated_at,
                        payload_json=payload_json,
                    )
                    session.add(record)
                    result.created += 1
                else:
                    changed = False
                    if record.run_id != run_id:
                        record.run_id = run_id
                        changed = True
                    if record.source_file != raw_file.name:
                        record.source_file = raw_file.name
                        changed = True
                    if record.row_key_source != row_key_source:
                        record.row_key_source = row_key_source
                        changed = True
                    if record.row_hash != row_hash:
                        record.row_hash = row_hash
                        changed = True
                    if record.source_updated_at != source_updated_at:
                        record.source_updated_at = source_updated_at
                        changed = True
                    if (record.payload_json or None) != payload_json:
                        record.payload_json = payload_json
                        changed = True
                    if changed:
                        result.updated += 1

                await session.flush()
                existing_records[row_key] = record
                _upsert_legacy_id_map(
                    index=legacy_index,
                    session=session,
                    domain="support",
                    legacy_id=f"{source_table}:{row_key}",
                    directstock_entity="legacy_raw_record",
                    directstock_id=record.id,
                    run_id=run_id,
                )

        if mode == "dry-run":
            await session.rollback()
        else:
            await session.commit()

    result.dedupe_count = max(0, result.processed - result.created - result.updated - result.errors)
    return result


async def _run_support_domain(args: argparse.Namespace, mode: str, *, run_id: int) -> DomainResult:
    result = DomainResult()
    support_file = _resolve_domain_file(
        args,
        "support",
        SUPPORT_RECORDS_FILE,
        required=not args.source.is_dir(),
    )

    if support_file is None:
        result.add_issue(
            issue_code="domain_source_missing",
            severity="warning",
            message=f"support typed import skipped: missing source file {SUPPORT_RECORDS_FILE}",
        )
    else:
        support_rows = _load_csv_rows(
            support_file,
            required_columns=("legacy_id", "record_type", "record_key"),
            limit=args.limit,
        )
        support_rows = _filter_rows_for_delta(
            support_rows,
            file_name=support_file.name,
            since_dt=args.since_dt,
            result=result,
        )
        result.processed = len(support_rows)

        async with AsyncSessionLocal() as session:
            legacy_index = await _load_legacy_id_index(session, domain="support")

            for row_no, row in support_rows:
                legacy_id = (row.get("legacy_id") or "").strip()
                record_type = (row.get("record_type") or "").strip()
                record_key = (row.get("record_key") or "").strip()
                row_reference = _row_ref(support_file.name, row_no)
                if not legacy_id or not record_type or not record_key:
                    result.add_issue(
                        issue_code="nullability_missing_required",
                        message=f"{row_reference} requires legacy_id, record_type, record_key",
                        row_reference=row_reference,
                    )
                    continue

                try:
                    payload_json = _parse_payload_json(row.get("payload_json"))
                except json.JSONDecodeError as exc:
                    result.add_issue(
                        issue_code="validation_invalid_json",
                        message=f"{row_reference} has invalid payload_json: {exc}",
                        row_reference=row_reference,
                    )
                    continue

                mapped = legacy_index.get((legacy_id, "legacy_support_record"))
                record: LegacySupportRecord | None = None
                if mapped is not None:
                    record = await session.get(LegacySupportRecord, mapped.directstock_id)
                if record is None:
                    record = (
                        await session.execute(
                            select(LegacySupportRecord).where(
                                LegacySupportRecord.record_type == record_type,
                                LegacySupportRecord.legacy_id == legacy_id,
                            )
                        )
                    ).scalar_one_or_none()

                is_created = record is None
                if is_created:
                    record = LegacySupportRecord(
                        run_id=run_id,
                        record_type=record_type,
                        legacy_id=legacy_id,
                        source_table=_string_or_none(row.get("source_table")) or record_type,
                        record_key=record_key,
                        record_value=_string_or_none(row.get("record_value")),
                        status_code=_string_or_none(row.get("status_code")),
                        description=_string_or_none(row.get("description")),
                        payload_json=payload_json,
                    )
                    session.add(record)
                    result.created += 1
                else:
                    changed = False
                    source_table = _string_or_none(row.get("source_table")) or record_type
                    record_value = _string_or_none(row.get("record_value"))
                    status_code = _string_or_none(row.get("status_code"))
                    description = _string_or_none(row.get("description"))

                    if record.run_id != run_id:
                        record.run_id = run_id
                        changed = True
                    if record.record_type != record_type:
                        record.record_type = record_type
                        changed = True
                    if record.legacy_id != legacy_id:
                        record.legacy_id = legacy_id
                        changed = True
                    if record.source_table != source_table:
                        record.source_table = source_table
                        changed = True
                    if record.record_key != record_key:
                        record.record_key = record_key
                        changed = True
                    if record.record_value != record_value:
                        record.record_value = record_value
                        changed = True
                    if record.status_code != status_code:
                        record.status_code = status_code
                        changed = True
                    if record.description != description:
                        record.description = description
                        changed = True
                    if (record.payload_json or None) != payload_json:
                        record.payload_json = payload_json
                        changed = True
                    if changed:
                        result.updated += 1

                await session.flush()
                _upsert_legacy_id_map(
                    index=legacy_index,
                    session=session,
                    domain="support",
                    legacy_id=legacy_id,
                    directstock_entity="legacy_support_record",
                    directstock_id=record.id,
                    run_id=run_id,
                )

            if mode == "dry-run":
                await session.rollback()
            else:
                await session.commit()

    raw_result = await _run_raw_table_staging(args, mode, run_id=run_id)
    _merge_domain_result(result, raw_result)

    result.dedupe_count = max(0, result.processed - result.created - result.updated - result.errors)
    if mode == "delta" and args.since:
        result.notes = f"delta_since={args.since}"
    return result


async def _run_domain(domain: str, args: argparse.Namespace) -> int:
    run = await _create_run(mode=args.mode, domain=domain, source_ref=str(args.source))
    try:
        if domain == "master":
            result = await _run_master_domain(args, args.mode, run_id=run.id)
        elif domain == "transactions":
            result = await _run_transactions_domain(args, args.mode, run_id=run.id)
        elif domain == "organization":
            result = await _run_organization_domain(args, args.mode, run_id=run.id)
        elif domain == "support":
            result = await _run_support_domain(args, args.mode, run_id=run.id)
        else:  # pragma: no cover
            raise RuntimeError(f"unsupported domain: {domain}")

        for issue in result.issues:
            await _add_issue(
                run.id,
                domain=domain,
                issue_code=issue.issue_code,
                severity=issue.severity,
                message=issue.message,
                row_reference=issue.row_reference,
                payload_json=issue.payload_json,
            )

        status = "completed" if result.errors == 0 else "failed"
        await _complete_run(
            run.id,
            status=status,
            processed=result.processed,
            created=result.created,
            updated=result.updated,
            errors=result.errors,
            reconciliation=_reconciliation_from_result(result),
            notes=result.notes,
        )
        print(
            "legacy migration domain completed",
            f"run_id={run.id}",
            f"domain={domain}",
            f"mode={args.mode}",
            f"processed={result.processed}",
            f"created={result.created}",
            f"updated={result.updated}",
            f"errors={result.errors}",
        )
        if result.errors > 0:
            return 1
        return 0
    except LegacyImportValidationError as exc:
        await _add_issue(run.id, domain=domain, issue_code="validation_error", message=str(exc))
        await _complete_run(
            run.id,
            status="failed",
            processed=0,
            created=0,
            updated=0,
            errors=1,
            reconciliation={
                "record_count_match": False,
                "nullability_violations": 1,
                "fk_integrity_violations": 0,
                "dedupe_count": 0,
            },
            notes="validation failed",
        )
        print(f"legacy migration validation failed (run_id={run.id}, domain={domain}): {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # pragma: no cover
        await _add_issue(run.id, domain=domain, issue_code="unexpected_error", message=str(exc))
        await _complete_run(
            run.id,
            status="failed",
            processed=0,
            created=0,
            updated=0,
            errors=1,
            reconciliation={
                "record_count_match": False,
                "nullability_violations": 0,
                "fk_integrity_violations": 0,
                "dedupe_count": 0,
            },
            notes="unexpected failure",
        )
        print(f"legacy migration failed (run_id={run.id}, domain={domain}): {exc}", file=sys.stderr)
        return 1


async def _run(args: argparse.Namespace) -> int:
    selected_domains = DOMAIN_ORDER if args.domain == "all" else [args.domain]
    exit_code = 0
    for domain in selected_domains:
        result = await _run_domain(domain, args)
        if result != 0:
            return result
        exit_code = max(exit_code, result)
    return exit_code


def main() -> int:
    args = parse_args()
    if args.batch_size <= 0:
        print("batch-size must be > 0", file=sys.stderr)
        return 1

    args.since_dt = None
    if args.since:
        try:
            args.since_dt = _parse_datetime(args.since)
        except ValueError as exc:
            print(f"invalid --since value: {exc}", file=sys.stderr)
            return 2
        if args.since_dt is None:
            print("invalid --since value: expected ISO datetime", file=sys.stderr)
            return 2

    if args.mode != "delta" and args.since:
        print("warning: --since is ignored unless --mode delta", file=sys.stderr)

    print(
        "legacy migration started",
        f"mode={args.mode}",
        f"domain={args.domain}",
        f"source={args.source}",
        f"batch_size={args.batch_size}",
        f"limit={args.limit}",
        f"since={args.since}",
        f"env={os.getenv('ENVIRONMENT', 'development')}",
    )
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
