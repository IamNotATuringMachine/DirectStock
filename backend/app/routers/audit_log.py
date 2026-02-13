from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_roles
from app.models.audit import AuditLog
from app.schemas.phase3 import AuditLogEntryResponse, AuditLogListResponse

router = APIRouter(prefix="/api/audit-log", tags=["audit-log"])
READ_ROLES = ("admin", "lagerleiter", "controller", "auditor")


def _to_response(item: AuditLog) -> AuditLogEntryResponse:
    return AuditLogEntryResponse(
        id=item.id,
        request_id=item.request_id,
        user_id=item.user_id,
        action=item.action,
        endpoint=item.endpoint,
        method=item.method,
        entity=item.entity,
        entity_id=item.entity_id,
        changed_fields=item.changed_fields,
        old_values=item.old_values,
        new_values=item.new_values,
        entity_snapshot_before=item.entity_snapshot_before,
        entity_snapshot_after=item.entity_snapshot_after,
        status_code=item.status_code,
        ip_address=item.ip_address,
        error_message=item.error_message,
        created_at=item.created_at,
    )


@router.get("", response_model=AuditLogListResponse)
async def list_audit_log(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    user_id: int | None = Query(default=None),
    entity: str | None = Query(default=None),
    action: str | None = Query(default=None),
    request_id: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> AuditLogListResponse:
    filters = []
    if user_id is not None:
        filters.append(AuditLog.user_id == user_id)
    if entity:
        filters.append(AuditLog.entity == entity)
    if action:
        filters.append(AuditLog.action == action)
    if request_id:
        filters.append(AuditLog.request_id == request_id)

    if date_from:
        start = datetime.combine(date_from, time.min, tzinfo=UTC)
        filters.append(AuditLog.created_at >= start)
    if date_to:
        end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=UTC)
        filters.append(AuditLog.created_at < end)

    count_stmt = select(func.count(AuditLog.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(AuditLog)
    if filters:
        stmt = stmt.where(*filters)

    rows = list(
        (
            await db.execute(
                stmt.order_by(AuditLog.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )

    return AuditLogListResponse(
        items=[_to_response(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
