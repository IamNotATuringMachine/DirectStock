from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_permissions
from app.models.inventory import Inventory
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.routers.warehouses_helpers import (
    _get_bin_occupied_quantity,
    _to_bin_response,
    _to_warehouse_response,
    _to_zone_response,
)
from app.routers.warehouses_workflow import create_bins_batch_workflow, get_bin_labels_pdf_bytes
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
from app.utils.qr_generator import generate_bin_label_png_bytes

router = APIRouter(prefix="/api", tags=["warehouses"])

WAREHOUSE_WRITE_PERMISSION = "module.warehouses.write"


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
    created_items = await create_bins_batch_workflow(
        db=db,
        zone_id=zone_id,
        payload=payload,
    )
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
    pdf_bytes = await get_bin_labels_pdf_bytes(
        db=db,
        bin_ids=payload.bin_ids,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename=\"directstock-bin-labels.pdf\"'},
    )
