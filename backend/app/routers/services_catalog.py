from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.phase5 import Service
from app.schemas.phase5 import ServiceCreate, ServiceListResponse, ServiceResponse, ServiceUpdate

router = APIRouter(prefix="/api/services", tags=["services"])


def _gross(net: Decimal, vat_rate: Decimal) -> Decimal:
    return (net * (Decimal("1") + vat_rate / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _normalize_vat_rate(value: Decimal) -> Decimal:
    normalized = Decimal(value).quantize(Decimal("0.01"))
    if normalized not in {Decimal("0"), Decimal("7"), Decimal("19")}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="vat_rate must be one of 0, 7, 19")
    return normalized


def _to_response(item: Service) -> ServiceResponse:
    net = Decimal(item.net_price)
    vat_rate = Decimal(item.vat_rate)
    return ServiceResponse(
        id=item.id,
        service_number=item.service_number,
        name=item.name,
        description=item.description,
        net_price=net,
        vat_rate=vat_rate,
        gross_price=_gross(net, vat_rate),
        currency=item.currency,
        status=item.status,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _generate_number() -> str:
    return f"SRV-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"


@router.get("", response_model=ServiceListResponse)
async def list_services(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.services.read")),
) -> ServiceListResponse:
    stmt = select(Service)
    count_stmt = select(func.count(Service.id))
    if status_filter:
        stmt = stmt.where(Service.status == status_filter)
        count_stmt = count_stmt.where(Service.status == status_filter)

    total = int((await db.execute(count_stmt)).scalar_one())
    rows = list((await db.execute(stmt.order_by(Service.id.desc()).offset((page - 1) * page_size).limit(page_size))).scalars())
    return ServiceListResponse(items=[_to_response(row) for row in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    payload: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.services.write")),
) -> ServiceResponse:
    item = Service(
        service_number=(payload.service_number or _generate_number()).strip().upper(),
        name=payload.name.strip(),
        description=payload.description,
        net_price=payload.net_price,
        vat_rate=_normalize_vat_rate(payload.vat_rate),
        currency=payload.currency.upper(),
        status=payload.status,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Service already exists") from exc

    await db.refresh(item)
    return _to_response(item)


@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.services.write")),
) -> ServiceResponse:
    item = (await db.execute(select(Service).where(Service.id == service_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] is not None:
        updates["name"] = updates["name"].strip()
    if "currency" in updates and updates["currency"] is not None:
        updates["currency"] = updates["currency"].upper()
    if "vat_rate" in updates and updates["vat_rate"] is not None:
        updates["vat_rate"] = _normalize_vat_rate(updates["vat_rate"])

    for key, value in updates.items():
        setattr(item, key, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Service update conflict") from exc

    await db.refresh(item)
    return _to_response(item)


@router.delete("/{service_id}")
async def delete_service(
    service_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.services.write")),
) -> dict[str, str]:
    item = (await db.execute(select(Service).where(Service.id == service_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    await db.delete(item)
    await db.commit()
    return {"message": "service deleted"}
