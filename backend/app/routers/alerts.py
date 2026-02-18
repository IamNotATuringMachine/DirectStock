from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.alerts import AlertEvent, AlertRule
from app.models.auth import User
from app.schemas.alerts import (
    AlertEventResponse,
    AlertListResponse,
    AlertRuleCreate,
    AlertRuleListResponse,
    AlertRuleResponse,
    AlertRuleUpdate,
)

router = APIRouter(prefix="/api", tags=["alerts"])

ALERT_READ_PERMISSION = "module.alerts.read"
ALERT_WRITE_PERMISSION = "module.alerts.write"


def _to_rule_response(item: AlertRule) -> AlertRuleResponse:
    return AlertRuleResponse(
        id=item.id,
        name=item.name,
        rule_type=item.rule_type,
        severity=item.severity,
        is_active=item.is_active,
        product_id=item.product_id,
        warehouse_id=item.warehouse_id,
        threshold_quantity=item.threshold_quantity,
        expiry_days=item.expiry_days,
        dedupe_window_minutes=item.dedupe_window_minutes,
        metadata_json=item.metadata_json,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_alert_response(item: AlertEvent) -> AlertEventResponse:
    return AlertEventResponse(
        id=item.id,
        rule_id=item.rule_id,
        alert_type=item.alert_type,
        severity=item.severity,
        status=item.status,
        title=item.title,
        message=item.message,
        source_key=item.source_key,
        product_id=item.product_id,
        warehouse_id=item.warehouse_id,
        bin_location_id=item.bin_location_id,
        batch_id=item.batch_id,
        triggered_at=item.triggered_at,
        acknowledged_at=item.acknowledged_at,
        acknowledged_by=item.acknowledged_by,
        metadata_json=item.metadata_json,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/alert-rules", response_model=AlertRuleListResponse)
async def list_alert_rules(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    rule_type: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(ALERT_READ_PERMISSION)),
) -> AlertRuleListResponse:
    filters = []

    if rule_type:
        filters.append(AlertRule.rule_type == rule_type)
    if is_active is not None:
        filters.append(AlertRule.is_active == is_active)
    if search:
        filters.append(AlertRule.name.ilike(f"%{search.strip()}%"))

    count_stmt = select(func.count(AlertRule.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(AlertRule)
    if filters:
        stmt = stmt.where(*filters)
    rows = list(
        (
            await db.execute(
                stmt.order_by(AlertRule.id.desc()).offset((page - 1) * page_size).limit(page_size)
            )
        ).scalars()
    )

    return AlertRuleListResponse(
        items=[_to_rule_response(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/alert-rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    payload: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(ALERT_WRITE_PERMISSION)),
) -> AlertRuleResponse:
    item = AlertRule(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_rule_response(item)


@router.get("/alert-rules/{rule_id}", response_model=AlertRuleResponse)
async def get_alert_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(ALERT_READ_PERMISSION)),
) -> AlertRuleResponse:
    item = (await db.execute(select(AlertRule).where(AlertRule.id == rule_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    return _to_rule_response(item)


@router.put("/alert-rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: int,
    payload: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(ALERT_WRITE_PERMISSION)),
) -> AlertRuleResponse:
    item = (await db.execute(select(AlertRule).where(AlertRule.id == rule_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_rule_response(item)


@router.delete("/alert-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(ALERT_WRITE_PERMISSION)),
) -> None:
    item = (await db.execute(select(AlertRule).where(AlertRule.id == rule_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")

    await db.delete(item)
    await db.commit()


@router.get("/alerts", response_model=AlertListResponse)
async def list_alerts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = Query(default=None),
    alert_type: str | None = Query(default=None),
    rule_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(ALERT_READ_PERMISSION)),
) -> AlertListResponse:
    filters = []
    if status_filter:
        filters.append(AlertEvent.status == status_filter)
    if severity:
        filters.append(AlertEvent.severity == severity)
    if alert_type:
        filters.append(AlertEvent.alert_type == alert_type)
    if rule_id is not None:
        filters.append(AlertEvent.rule_id == rule_id)
    if product_id is not None:
        filters.append(AlertEvent.product_id == product_id)
    if warehouse_id is not None:
        filters.append(AlertEvent.warehouse_id == warehouse_id)

    count_stmt = select(func.count(AlertEvent.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(AlertEvent)
    if filters:
        stmt = stmt.where(*filters)

    rows = list(
        (
            await db.execute(
                stmt.order_by(AlertEvent.triggered_at.desc(), AlertEvent.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )

    return AlertListResponse(
        items=[_to_alert_response(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/alerts/{alert_id}/ack", response_model=AlertEventResponse)
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(ALERT_READ_PERMISSION)),
) -> AlertEventResponse:
    item = (await db.execute(select(AlertEvent).where(AlertEvent.id == alert_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    if item.status != "acknowledged":
        item.status = "acknowledged"
        item.acknowledged_at = datetime.now(UTC)
        item.acknowledged_by = current_user.id
        await db.commit()
        await db.refresh(item)

    return _to_alert_response(item)
