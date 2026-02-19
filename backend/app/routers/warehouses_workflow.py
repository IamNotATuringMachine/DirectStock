from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.warehouse import BinLocation, WarehouseZone
from app.schemas.warehouse import BinBatchCreateRequest
from app.utils.http_status import HTTP_422_UNPROCESSABLE
from app.utils.qr_generator import generate_bin_labels_pdf


async def create_bins_batch_workflow(
    *,
    db: AsyncSession,
    zone_id: int,
    payload: BinBatchCreateRequest,
) -> list[BinLocation]:
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

    return created_items


async def get_bin_labels_pdf_bytes(
    *,
    db: AsyncSession,
    bin_ids: list[int],
) -> bytes:
    bins = list((await db.execute(select(BinLocation).where(BinLocation.id.in_(bin_ids)))).scalars())
    by_id = {item.id: item for item in bins}

    missing_ids = [bin_id for bin_id in bin_ids if bin_id not in by_id]
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bins not found: {missing_ids}",
        )

    ordered_bins = [by_id[bin_id] for bin_id in bin_ids]
    labels = [
        (item.code, item.qr_code_data or f"DS:BIN:{item.code}")
        for item in ordered_bins
    ]
    return generate_bin_labels_pdf(labels)
