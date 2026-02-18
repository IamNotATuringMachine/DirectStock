from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_permissions
from app.models.inventory import Inventory
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.warehouse import (
    BinBatchCreateRequest,
    BinBatchCreateResponse,
    BinCreate,
    BinQrPdfRequest,
    BinResponse,
    BinUpdate,
    WarehouseCreate,
    WarehouseResponse,
    WarehouseUpdate,
    ZoneCreate,
    ZoneResponse,
    ZoneUpdate,
)
from app.utils.http_status import HTTP_422_UNPROCESSABLE
from app.utils.qr_generator import generate_bin_label_png_bytes, generate_bin_labels_pdf

router = APIRouter(prefix="/api", tags=["warehouses"])

WAREHOUSE_WRITE_PERMISSION = "module.warehouses.write"


def _to_warehouse_response(warehouse: Warehouse) -> WarehouseResponse:
    return WarehouseResponse(
        id=warehouse.id,
        code=warehouse.code,
        name=warehouse.name,
        address=warehouse.address,
        is_active=warehouse.is_active,
        created_at=warehouse.created_at,
        updated_at=warehouse.updated_at,
    )


def _to_zone_response(zone: WarehouseZone) -> ZoneResponse:
    return ZoneResponse(
        id=zone.id,
        warehouse_id=zone.warehouse_id,
        code=zone.code,
        name=zone.name,
        zone_type=zone.zone_type,
        is_active=zone.is_active,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )


def _to_bin_response(
    bin_location: BinLocation,
    *,
    occupied_quantity: Decimal = Decimal("0"),
) -> BinResponse:
    return BinResponse(
        id=bin_location.id,
        zone_id=bin_location.zone_id,
        code=bin_location.code,
        bin_type=bin_location.bin_type,
        max_weight=bin_location.max_weight,
        max_volume=bin_location.max_volume,
        qr_code_data=bin_location.qr_code_data,
        is_active=bin_location.is_active,
        is_occupied=occupied_quantity > 0,
        occupied_quantity=occupied_quantity,
        created_at=bin_location.created_at,
        updated_at=bin_location.updated_at,
    )


async def _get_bin_occupied_quantity(db: AsyncSession, bin_id: int) -> Decimal:
    quantity = (
        await db.execute(
            select(func.coalesce(func.sum(Inventory.quantity), 0)).where(
                Inventory.bin_location_id == bin_id
            )
        )
    ).scalar_one()
    return Decimal(quantity)


@router.get("/warehouses", response_model=list[WarehouseResponse])
async def list_warehouses(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[WarehouseResponse]:
    result = await db.execute(select(Warehouse).order_by(Warehouse.code.asc()))
    return [_to_warehouse_response(item) for item in result.scalars()]


@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    payload: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> WarehouseResponse:
    warehouse = Warehouse(**payload.model_dump())
    db.add(warehouse)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Warehouse already exists") from exc

    await db.refresh(warehouse)
    return _to_warehouse_response(warehouse)


@router.get("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
async def get_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> WarehouseResponse:
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return _to_warehouse_response(warehouse)


@router.put("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
async def update_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> WarehouseResponse:
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(warehouse, key, value)

    await db.commit()
    await db.refresh(warehouse)
    return _to_warehouse_response(warehouse)


@router.delete("/warehouses/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> None:
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    await db.delete(warehouse)
    await db.commit()


@router.get("/warehouses/{warehouse_id}/zones", response_model=list[ZoneResponse])
async def list_zones(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[ZoneResponse]:
    result = await db.execute(
        select(WarehouseZone).where(WarehouseZone.warehouse_id == warehouse_id).order_by(WarehouseZone.code.asc())
    )
    return [_to_zone_response(item) for item in result.scalars()]


@router.post("/warehouses/{warehouse_id}/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    warehouse_id: int,
    payload: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> ZoneResponse:
    warehouse = (await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))).scalar_one_or_none()
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    zone = WarehouseZone(warehouse_id=warehouse_id, **payload.model_dump())
    db.add(zone)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Zone already exists") from exc

    await db.refresh(zone)
    return _to_zone_response(zone)


@router.put("/zones/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    zone_id: int,
    payload: ZoneUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> ZoneResponse:
    zone = (await db.execute(select(WarehouseZone).where(WarehouseZone.id == zone_id))).scalar_one_or_none()
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(zone, key, value)

    await db.commit()
    await db.refresh(zone)
    return _to_zone_response(zone)


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> None:
    zone = (await db.execute(select(WarehouseZone).where(WarehouseZone.id == zone_id))).scalar_one_or_none()
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    await db.delete(zone)
    await db.commit()


@router.get("/zones/{zone_id}/bins", response_model=list[BinResponse])
async def list_bins(
    zone_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[BinResponse]:
    result = await db.execute(
        select(
            BinLocation,
            func.coalesce(func.sum(Inventory.quantity), 0).label("occupied_quantity"),
        )
        .outerjoin(Inventory, Inventory.bin_location_id == BinLocation.id)
        .where(BinLocation.zone_id == zone_id)
        .group_by(BinLocation.id)
        .order_by(BinLocation.code.asc())
    )
    return [
        _to_bin_response(
            bin_location,
            occupied_quantity=Decimal(occupied_quantity),
        )
        for bin_location, occupied_quantity in result.all()
    ]


@router.post("/zones/{zone_id}/bins", response_model=BinResponse, status_code=status.HTTP_201_CREATED)
async def create_bin(
    zone_id: int,
    payload: BinCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> BinResponse:
    zone = (await db.execute(select(WarehouseZone).where(WarehouseZone.id == zone_id))).scalar_one_or_none()
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    data = payload.model_dump()
    if not data.get("qr_code_data"):
        data["qr_code_data"] = f"DS:BIN:{data['code']}"

    bin_location = BinLocation(zone_id=zone_id, **data)
    db.add(bin_location)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bin already exists") from exc

    await db.refresh(bin_location)
    return _to_bin_response(bin_location)


@router.post("/zones/{zone_id}/bins/batch", response_model=BinBatchCreateResponse)
async def create_bins_batch(
    zone_id: int,
    payload: BinBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> BinBatchCreateResponse:
    zone = (await db.execute(select(WarehouseZone).where(WarehouseZone.id == zone_id))).scalar_one_or_none()
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    if payload.aisle_from > payload.aisle_to or payload.shelf_from > payload.shelf_to or payload.level_from > payload.level_to:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid batch range")

    created_items: list[BinLocation] = []
    for aisle in range(payload.aisle_from, payload.aisle_to + 1):
        for shelf in range(payload.shelf_from, payload.shelf_to + 1):
            for level in range(payload.level_from, payload.level_to + 1):
                code = f"{payload.prefix}-{aisle:02d}-{shelf:02d}-{level:02d}"
                created_items.append(
                    BinLocation(
                        zone_id=zone_id,
                        code=code,
                        bin_type=payload.bin_type,
                        qr_code_data=f"DS:BIN:{code}",
                        is_active=True,
                    )
                )

    db.add_all(created_items)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Batch contains duplicate bins") from exc

    for item in created_items:
        await db.refresh(item)

    responses = [_to_bin_response(item) for item in created_items]
    return BinBatchCreateResponse(created_count=len(responses), items=responses)


@router.put("/bins/{bin_id}", response_model=BinResponse)
async def update_bin(
    bin_id: int,
    payload: BinUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> BinResponse:
    bin_location = (await db.execute(select(BinLocation).where(BinLocation.id == bin_id))).scalar_one_or_none()
    if bin_location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(bin_location, key, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while updating bin") from exc

    await db.refresh(bin_location)
    return _to_bin_response(bin_location)


@router.delete("/bins/{bin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bin(
    bin_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> None:
    bin_location = (await db.execute(select(BinLocation).where(BinLocation.id == bin_id))).scalar_one_or_none()
    if bin_location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")

    await db.delete(bin_location)
    await db.commit()


@router.get("/bins/by-qr/{qr_data}", response_model=BinResponse)
async def get_bin_by_qr(
    qr_data: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> BinResponse:
    bin_location = (
        await db.execute(select(BinLocation).where(BinLocation.qr_code_data == qr_data))
    ).scalar_one_or_none()
    if bin_location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found for QR")
    occupied_quantity = await _get_bin_occupied_quantity(db, bin_location.id)
    return _to_bin_response(bin_location, occupied_quantity=occupied_quantity)


@router.get("/bins/{bin_id}/qr-code")
async def get_bin_qr_code(
    bin_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> Response:
    bin_location = (await db.execute(select(BinLocation).where(BinLocation.id == bin_id))).scalar_one_or_none()
    if bin_location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")

    qr_data = bin_location.qr_code_data or f"DS:BIN:{bin_location.code}"
    png_bytes = generate_bin_label_png_bytes(bin_location.code, qr_data)

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename=\"bin-{bin_location.code}.png\"'},
    )


@router.post("/bins/qr-codes/pdf")
async def get_bin_qr_codes_pdf(
    payload: BinQrPdfRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WAREHOUSE_WRITE_PERMISSION)),
) -> Response:
    requested_ids = payload.bin_ids
    bins = list(
        (
            await db.execute(select(BinLocation).where(BinLocation.id.in_(requested_ids)))
        ).scalars()
    )
    by_id = {item.id: item for item in bins}

    missing_ids = [bin_id for bin_id in requested_ids if bin_id not in by_id]
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bins not found: {missing_ids}",
        )

    ordered_bins = [by_id[bin_id] for bin_id in requested_ids]
    labels = [
        (item.code, item.qr_code_data or f"DS:BIN:{item.code}")
        for item in ordered_bins
    ]
    pdf_bytes = generate_bin_labels_pdf(labels)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename=\"directstock-bin-labels.pdf\"'},
    )
