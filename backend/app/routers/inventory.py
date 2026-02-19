from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.inventory import (
    InventoryByBinItem,
    InventoryBatchItem,
    InventoryByProductItem,
    InventoryItem,
    InventoryListResponse,
    InventorySummary,
    LowStockItem,
    StockMovementItem,
)
from .inventory_batch_queries import (
    inventory_batches_by_bin_data,
    inventory_batches_by_product_data,
)
from .inventory_queries import (
    inventory_by_bin_data,
    inventory_by_product_data,
    inventory_by_warehouse_data,
    inventory_summary_data,
    list_inventory_data,
    list_movements_data,
    low_stock_data,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("", response_model=InventoryListResponse)
async def list_inventory(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    search: str | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> InventoryListResponse:
    return await list_inventory_data(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        warehouse_id=warehouse_id,
    )


@router.get("/by-product/{product_id}", response_model=list[InventoryByProductItem])
async def inventory_by_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[InventoryByProductItem]:
    return await inventory_by_product_data(db=db, product_id=product_id)


@router.get("/by-bin/{bin_id}", response_model=list[InventoryByBinItem])
async def inventory_by_bin(
    bin_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[InventoryByBinItem]:
    return await inventory_by_bin_data(db=db, bin_id=bin_id)


@router.get("/by-product/{product_id}/batches", response_model=list[InventoryBatchItem])
async def inventory_batches_by_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[InventoryBatchItem]:
    return await inventory_batches_by_product_data(db=db, product_id=product_id)


@router.get("/by-bin/{bin_id}/batches", response_model=list[InventoryBatchItem])
async def inventory_batches_by_bin(
    bin_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[InventoryBatchItem]:
    return await inventory_batches_by_bin_data(db=db, bin_id=bin_id)


@router.get("/by-warehouse/{warehouse_id}", response_model=list[InventoryItem])
async def inventory_by_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[InventoryItem]:
    return await inventory_by_warehouse_data(db=db, warehouse_id=warehouse_id)


@router.get("/low-stock", response_model=list[LowStockItem])
async def low_stock(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[LowStockItem]:
    return await low_stock_data(db=db)


@router.get("/movements", response_model=list[StockMovementItem])
async def list_movements(
    limit: int = Query(default=50, ge=1, le=200),
    product_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[StockMovementItem]:
    return await list_movements_data(db=db, limit=limit, product_id=product_id)


@router.get("/summary", response_model=InventorySummary)
async def inventory_summary(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> InventorySummary:
    return await inventory_summary_data(db=db)
