from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_roles
from app.models.catalog import Product, ProductWarehouseSetting
from app.models.warehouse import Warehouse
from app.schemas.product_settings import ProductWarehouseSettingResponse, ProductWarehouseSettingUpsert

router = APIRouter(prefix="/api", tags=["product-settings"])

PRODUCT_SETTING_ROLES = ("admin", "lagerleiter", "einkauf")


def _to_response(item: ProductWarehouseSetting) -> ProductWarehouseSettingResponse:
    return ProductWarehouseSettingResponse(
        id=item.id,
        product_id=item.product_id,
        warehouse_id=item.warehouse_id,
        ean=item.ean,
        gtin=item.gtin,
        net_weight=item.net_weight,
        gross_weight=item.gross_weight,
        length_cm=item.length_cm,
        width_cm=item.width_cm,
        height_cm=item.height_cm,
        min_stock=item.min_stock,
        reorder_point=item.reorder_point,
        max_stock=item.max_stock,
        safety_stock=item.safety_stock,
        lead_time_days=item.lead_time_days,
        qr_code_data=item.qr_code_data,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/products/{product_id}/warehouse-settings", response_model=list[ProductWarehouseSettingResponse])
async def list_product_warehouse_settings(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*PRODUCT_SETTING_ROLES)),
) -> list[ProductWarehouseSettingResponse]:
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    rows = list(
        (
            await db.execute(
                select(ProductWarehouseSetting)
                .where(ProductWarehouseSetting.product_id == product_id)
                .order_by(ProductWarehouseSetting.warehouse_id.asc())
            )
        ).scalars()
    )
    return [_to_response(item) for item in rows]


@router.put(
    "/products/{product_id}/warehouse-settings/{warehouse_id}",
    response_model=ProductWarehouseSettingResponse,
)
async def upsert_product_warehouse_setting(
    product_id: int,
    warehouse_id: int,
    payload: ProductWarehouseSettingUpsert,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*PRODUCT_SETTING_ROLES)),
) -> ProductWarehouseSettingResponse:
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    warehouse = (await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))).scalar_one_or_none()
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    item = (
        await db.execute(
            select(ProductWarehouseSetting).where(
                ProductWarehouseSetting.product_id == product_id,
                ProductWarehouseSetting.warehouse_id == warehouse_id,
            )
        )
    ).scalar_one_or_none()

    if item is None:
        item = ProductWarehouseSetting(
            product_id=product_id,
            warehouse_id=warehouse_id,
            **payload.model_dump(),
        )
        db.add(item)
    else:
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, key, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while saving product warehouse setting") from exc

    await db.refresh(item)
    return _to_response(item)


@router.delete(
    "/products/{product_id}/warehouse-settings/{warehouse_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_product_warehouse_setting(
    product_id: int,
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*PRODUCT_SETTING_ROLES)),
) -> None:
    item = (
        await db.execute(
            select(ProductWarehouseSetting).where(
                ProductWarehouseSetting.product_id == product_id,
                ProductWarehouseSetting.warehouse_id == warehouse_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product warehouse setting not found")

    await db.delete(item)
    await db.commit()
