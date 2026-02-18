from datetime import UTC, datetime
from decimal import Decimal
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.catalog import Product
from app.models.inventory import GoodsIssue, GoodsIssueItem
from app.models.phase3 import PickTask, PickWave
from app.models.warehouse import BinLocation
from app.schemas.phase3 import (
    PickTaskResponse,
    PickTaskUpdate,
    PickWaveCreate,
    PickWaveDetailResponse,
    PickWaveResponse,
)

router = APIRouter(prefix="/api", tags=["picking"])

PICKING_READ_PERMISSION = "module.picking.read"
PICKING_WRITE_PERMISSION = "module.picking.write"


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_wave_number() -> str:
    return f"PW-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


def _parse_bin_coordinates(code: str | None) -> tuple[int, int, int, str]:
    if not code:
        return (9999, 9999, 9999, "")
    parts = code.split("-")
    if len(parts) >= 4:
        try:
            return (int(parts[1]), int(parts[2]), int(parts[3]), code)
        except ValueError:
            return (9999, 9999, 9999, code)
    return (9999, 9999, 9999, code)


def _distance(a: tuple[int, int, int, str], b: tuple[int, int, int, str]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def _ordered_task_keys(task_keys: list[tuple[int | None, int, str | None]]) -> list[tuple[int | None, int, str | None]]:
    if not task_keys:
        return []
    ordered = sorted(task_keys, key=lambda key: ((key[2] or "ZZZ"), key[1]))
    result = [ordered.pop(0)]
    while ordered:
        last = result[-1]
        last_coords = _parse_bin_coordinates(last[2])
        next_index = min(
            range(len(ordered)),
            key=lambda idx: (
                _distance(last_coords, _parse_bin_coordinates(ordered[idx][2])),
                ordered[idx][2] or "",
                ordered[idx][1],
            ),
        )
        result.append(ordered.pop(next_index))
    return result


def _to_wave_response(item: PickWave) -> PickWaveResponse:
    return PickWaveResponse(
        id=item.id,
        wave_number=item.wave_number,
        status=item.status,
        notes=item.notes,
        released_at=item.released_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _task_response_rows(db: AsyncSession, wave_id: int) -> list[PickTaskResponse]:
    rows = (
        await db.execute(
            select(
                PickTask,
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                BinLocation.code.label("source_bin_code"),
            )
            .join(Product, Product.id == PickTask.product_id)
            .outerjoin(BinLocation, BinLocation.id == PickTask.source_bin_id)
            .where(PickTask.pick_wave_id == wave_id)
            .order_by(PickTask.sequence_no.asc(), PickTask.id.asc())
        )
    ).all()

    return [
        PickTaskResponse(
            id=row[0].id,
            pick_wave_id=row[0].pick_wave_id,
            goods_issue_id=row[0].goods_issue_id,
            goods_issue_item_id=row[0].goods_issue_item_id,
            product_id=row[0].product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            source_bin_id=row[0].source_bin_id,
            source_bin_code=row.source_bin_code,
            quantity=row[0].quantity,
            picked_quantity=row[0].picked_quantity,
            unit=row[0].unit,
            status=row[0].status,
            sequence_no=row[0].sequence_no,
            picked_at=row[0].picked_at,
            picked_by=row[0].picked_by,
            created_at=row[0].created_at,
            updated_at=row[0].updated_at,
        )
        for row in rows
    ]


@router.post("/pick-waves", response_model=PickWaveDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_pick_wave(
    payload: PickWaveCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(PICKING_WRITE_PERMISSION)),
) -> PickWaveDetailResponse:
    issue_stmt = (
        select(GoodsIssue.id)
        .where(GoodsIssue.status == "draft")
        .order_by(GoodsIssue.id.asc())
    )
    if payload.goods_issue_ids:
        issue_stmt = issue_stmt.where(GoodsIssue.id.in_(payload.goods_issue_ids))

    issue_ids = [row[0] for row in (await db.execute(issue_stmt)).all()]
    if not issue_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No draft goods issues available")

    item_rows = (
        await db.execute(
            select(
                GoodsIssueItem,
                BinLocation.code.label("source_bin_code"),
            )
            .outerjoin(BinLocation, BinLocation.id == GoodsIssueItem.source_bin_id)
            .where(GoodsIssueItem.goods_issue_id.in_(issue_ids))
            .order_by(GoodsIssueItem.id.asc())
        )
    ).all()

    grouped: dict[tuple[int | None, int, str | None], dict[str, object]] = {}
    for row in item_rows:
        item = row[0]
        key = (item.source_bin_id, item.product_id, row.source_bin_code)
        bucket = grouped.setdefault(
            key,
            {
                "goods_issue_ids": set(),
                "quantity": Decimal("0"),
                "unit": item.unit,
            },
        )
        bucket["goods_issue_ids"].add(item.goods_issue_id)
        bucket["quantity"] = Decimal(bucket["quantity"]) + Decimal(item.requested_quantity)

    wave = PickWave(
        wave_number=payload.wave_number or _generate_wave_number(),
        status="draft",
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(wave)
    await db.flush()

    ordered_keys = _ordered_task_keys(list(grouped.keys()))
    for sequence_no, key in enumerate(ordered_keys, start=1):
        source_bin_id, product_id, _ = key
        bucket = grouped[key]
        issue_ids_for_task = sorted(bucket["goods_issue_ids"])
        db.add(
            PickTask(
                pick_wave_id=wave.id,
                goods_issue_id=issue_ids_for_task[0] if len(issue_ids_for_task) == 1 else None,
                goods_issue_item_id=None,
                product_id=product_id,
                source_bin_id=source_bin_id,
                quantity=Decimal(bucket["quantity"]),
                picked_quantity=Decimal("0"),
                unit=str(bucket["unit"]),
                status="open",
                sequence_no=sequence_no,
            )
        )

    await db.commit()
    await db.refresh(wave)
    tasks = await _task_response_rows(db, wave.id)
    return PickWaveDetailResponse(wave=_to_wave_response(wave), tasks=tasks)


@router.get("/pick-waves", response_model=list[PickWaveResponse])
async def list_pick_waves(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PICKING_READ_PERMISSION)),
) -> list[PickWaveResponse]:
    rows = list((await db.execute(select(PickWave).order_by(PickWave.id.desc()))).scalars())
    return [_to_wave_response(item) for item in rows]


@router.get("/pick-waves/{wave_id}", response_model=PickWaveDetailResponse)
async def get_pick_wave(
    wave_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PICKING_READ_PERMISSION)),
) -> PickWaveDetailResponse:
    wave = (await db.execute(select(PickWave).where(PickWave.id == wave_id))).scalar_one_or_none()
    if wave is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pick wave not found")
    tasks = await _task_response_rows(db, wave.id)
    return PickWaveDetailResponse(wave=_to_wave_response(wave), tasks=tasks)


@router.post("/pick-waves/{wave_id}/release", response_model=PickWaveResponse)
async def release_pick_wave(
    wave_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PICKING_WRITE_PERMISSION)),
) -> PickWaveResponse:
    wave = (await db.execute(select(PickWave).where(PickWave.id == wave_id))).scalar_one_or_none()
    if wave is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pick wave not found")
    if wave.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft waves can be released")

    wave.status = "released"
    wave.released_at = _now()
    await db.commit()
    await db.refresh(wave)
    return _to_wave_response(wave)


@router.patch("/pick-tasks/{task_id}", response_model=PickTaskResponse)
async def update_pick_task(
    task_id: int,
    payload: PickTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(PICKING_WRITE_PERMISSION)),
) -> PickTaskResponse:
    task = (await db.execute(select(PickTask).where(PickTask.id == task_id))).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pick task not found")

    wave = (await db.execute(select(PickWave).where(PickWave.id == task.pick_wave_id))).scalar_one_or_none()
    if wave is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pick wave not found")
    if wave.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pick wave is already closed")

    task.status = payload.status
    if payload.status == "picked":
        task.picked_quantity = payload.picked_quantity if payload.picked_quantity is not None else task.quantity
        task.picked_at = _now()
        task.picked_by = current_user.id
        if wave.status == "released":
            wave.status = "in_progress"
    else:
        if payload.picked_quantity is not None:
            task.picked_quantity = payload.picked_quantity
        elif payload.status == "open":
            task.picked_quantity = Decimal("0")
        task.picked_at = None if payload.status == "open" else task.picked_at
        task.picked_by = None if payload.status == "open" else task.picked_by

    await db.commit()

    row = (
        await db.execute(
            select(
                PickTask,
                Product.product_number.label("product_number"),
                Product.name.label("product_name"),
                BinLocation.code.label("source_bin_code"),
            )
            .join(Product, Product.id == PickTask.product_id)
            .outerjoin(BinLocation, BinLocation.id == PickTask.source_bin_id)
            .where(PickTask.id == task.id)
        )
    ).one()

    return PickTaskResponse(
        id=row[0].id,
        pick_wave_id=row[0].pick_wave_id,
        goods_issue_id=row[0].goods_issue_id,
        goods_issue_item_id=row[0].goods_issue_item_id,
        product_id=row[0].product_id,
        product_number=row.product_number,
        product_name=row.product_name,
        source_bin_id=row[0].source_bin_id,
        source_bin_code=row.source_bin_code,
        quantity=row[0].quantity,
        picked_quantity=row[0].picked_quantity,
        unit=row[0].unit,
        status=row[0].status,
        sequence_no=row[0].sequence_no,
        picked_at=row[0].picked_at,
        picked_by=row[0].picked_by,
        created_at=row[0].created_at,
        updated_at=row[0].updated_at,
    )


@router.post("/pick-waves/{wave_id}/complete", response_model=PickWaveResponse)
async def complete_pick_wave(
    wave_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PICKING_WRITE_PERMISSION)),
) -> PickWaveResponse:
    wave = (await db.execute(select(PickWave).where(PickWave.id == wave_id))).scalar_one_or_none()
    if wave is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pick wave not found")
    if wave.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pick wave is already closed")

    open_task_exists = (
        await db.execute(
            select(PickTask.id).where(
                PickTask.pick_wave_id == wave_id,
                PickTask.status == "open",
            )
        )
    ).scalar_one_or_none()
    if open_task_exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pick wave has open tasks")

    wave.status = "completed"
    wave.completed_at = _now()
    await db.commit()
    await db.refresh(wave)
    return _to_wave_response(wave)
