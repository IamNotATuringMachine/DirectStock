import csv
import io
import json
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.dependencies import get_db, require_permissions
from app.models.alerts import AlertEvent
from app.models.catalog import Product
from app.models.inventory import Inventory, InventoryCountItem, InventoryCountSession, StockMovement, GoodsReceipt
from app.models.phase3 import ApprovalRequest, PickTask, PickWave, PurchaseRecommendation, ReturnOrder, ReturnOrderItem
from app.models.phase4 import (
    ForecastItem,
    ForecastRun,
    InterWarehouseTransfer,
    InterWarehouseTransferItem,
)
from app.models.warehouse import BinLocation, WarehouseZone
from app.schemas.phase4 import (
    DemandForecastRecomputeRequest,
    DemandForecastResponse,
    DemandForecastRow,
    TrendResponse,
    TrendRow,
)
from app.schemas.reports import (
    ReportAbcResponse,
    ReportAbcRow,
    ReportInboundOutboundResponse,
    ReportInboundOutboundRow,
    ReportInventoryAccuracyResponse,
    ReportInventoryAccuracySessionRow,
    ReportKpiResponse,
    ReportMovementResponse,
    ReportMovementRow,
    ReportPickingPerformanceResponse,
    ReportPickingPerformanceRow,
    ReportPurchaseRecommendationResponse,
    ReportPurchaseRecommendationRow,
    ReportReturnsResponse,
    ReportReturnsRow,
    ReportStockResponse,
    ReportStockRow,
)
from app.schemas.user import MessageResponse
from app.services.forecast import recompute_demand_forecast
from app.services.reports.aggregation_service import quantize
from app.utils.http_status import HTTP_422_UNPROCESSABLE

router = APIRouter(prefix="/api/reports", tags=["reports"])
REPORTS_READ_PERMISSION = "module.reports.read"
ExportFormat = Literal["json", "csv", "xlsx", "pdf"]


def _quantize(value: Decimal, digits: str = "0.01") -> Decimal:
    return quantize(value, digits)


def _date_bounds(date_from: date | None, date_to: date | None) -> tuple[date, date, datetime, datetime]:
    today = datetime.now(UTC).date()
    start_day = date_from or (today - timedelta(days=29))
    end_day = date_to or today
    if end_day < start_day:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="date_to must be greater than or equal to date_from",
        )
    start = datetime.combine(start_day, time.min, tzinfo=UTC)
    end = datetime.combine(end_day + timedelta(days=1), time.min, tzinfo=UTC)
    return start_day, end_day, start, end


def _serialize_tabular_value(value: object) -> object:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict | list):
        return json.dumps(value, ensure_ascii=True)
    return value


def _normalize_tabular_rows(fieldnames: list[str], rows: list[dict[str, object]]) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for row in rows:
        normalized.append({field: _serialize_tabular_value(row.get(field)) for field in fieldnames})
    return normalized


def _csv_response(fieldnames: list[str], rows: list[dict[str, object]], filename: str) -> Response:
    normalized_rows = _normalize_tabular_rows(fieldnames, rows)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in normalized_rows:
        writer.writerow(row)
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _xlsx_response(fieldnames: list[str], rows: list[dict[str, object]], filename: str) -> Response:
    normalized_rows = _normalize_tabular_rows(fieldnames, rows)
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Report"
    worksheet.append(fieldnames)
    for row in normalized_rows:
        worksheet.append([row.get(field) for field in fieldnames])

    output = io.BytesIO()
    workbook.save(output)
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _pdf_response(fieldnames: list[str], rows: list[dict[str, object]], filename: str) -> Response:
    normalized_rows = _normalize_tabular_rows(fieldnames, rows)
    table_data: list[list[str]] = [fieldnames]
    for row in normalized_rows:
        table_data.append([str(row.get(field) or "") for field in fieldnames])

    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=8 * mm,
        rightMargin=8 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )
    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E5E7EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("FONTSIZE", (0, 1), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#9CA3AF")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    document.build([table])
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _tabular_response(
    *,
    output_format: Literal["csv", "xlsx", "pdf"],
    fieldnames: list[str],
    rows: list[dict[str, object]],
    basename: str,
) -> Response:
    if output_format == "csv":
        return _csv_response(fieldnames=fieldnames, rows=rows, filename=f"{basename}.csv")
    if output_format == "xlsx":
        return _xlsx_response(fieldnames=fieldnames, rows=rows, filename=f"{basename}.xlsx")
    return _pdf_response(fieldnames=fieldnames, rows=rows, filename=f"{basename}.pdf")


def _build_inventory_accuracy(
    rows: list,
) -> tuple[list[ReportInventoryAccuracySessionRow], ReportInventoryAccuracyResponse]:
    sessions: list[ReportInventoryAccuracySessionRow] = []
    total_items = 0
    counted_items = 0
    exact_match_items = 0
    recount_required_items = 0

    for row in rows:
        row_total = int(row.total_items or 0)
        row_counted = int(row.counted_items or 0)
        row_exact = int(row.exact_match_items or 0)
        row_recount = int(row.recount_required_items or 0)
        accuracy_percent = _quantize(
            (Decimal(row_exact) * Decimal("100") / Decimal(row_counted)) if row_counted else Decimal("0")
        )
        sessions.append(
            ReportInventoryAccuracySessionRow(
                session_id=row.session_id,
                session_number=row.session_number,
                completed_at=row.completed_at,
                total_items=row_total,
                counted_items=row_counted,
                exact_match_items=row_exact,
                recount_required_items=row_recount,
                accuracy_percent=accuracy_percent,
            )
        )
        total_items += row_total
        counted_items += row_counted
        exact_match_items += row_exact
        recount_required_items += row_recount

    overall_accuracy_percent = _quantize(
        (Decimal(exact_match_items) * Decimal("100") / Decimal(counted_items)) if counted_items else Decimal("0")
    )
    payload = ReportInventoryAccuracyResponse(
        total_sessions=len(sessions),
        total_items=total_items,
        counted_items=counted_items,
        exact_match_items=exact_match_items,
        recount_required_items=recount_required_items,
        overall_accuracy_percent=overall_accuracy_percent,
        sessions=sessions,
    )
    return sessions, payload


__all__ = [name for name in globals() if not name.startswith("__")]
