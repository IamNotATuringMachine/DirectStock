from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.catalog import Product, ProductGroup, ProductWarehouseSetting
from app.schemas.product import (
    ProductCreate,
    ProductGroupCreate,
    ProductGroupResponse,
    ProductGroupUpdate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)

router = APIRouter(prefix="/api", tags=["products"])


def _to_product_response(product: Product) -> ProductResponse:
    return ProductResponse(
        id=product.id,
        product_number=product.product_number,
        name=product.name,
        description=product.description,
        product_group_id=product.product_group_id,
        group_name=product.group.name if product.group else None,
        unit=product.unit,
        status=product.status,
        requires_item_tracking=product.requires_item_tracking,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


def _to_group_response(group: ProductGroup) -> ProductGroupResponse:
    return ProductGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        parent_id=group.parent_id,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.get("/products", response_model=ProductListResponse)
async def list_products(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    search: str | None = Query(default=None),
    group_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> ProductListResponse:
    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Product.product_number.ilike(term),
                Product.name.ilike(term),
                Product.description.ilike(term),
            )
        )
    if group_id is not None:
        filters.append(Product.product_group_id == group_id)
    if status_filter:
        filters.append(Product.status == status_filter)

    count_stmt = select(func.count(Product.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Product)
        .options(joinedload(Product.group))
        .order_by(Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if filters:
        stmt = stmt.where(*filters)

    result = await db.execute(stmt)
    items = list(result.scalars())
    return ProductListResponse(
        items=[_to_product_response(product) for product in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> ProductResponse:
    stmt = select(Product).where(Product.id == product_id).options(joinedload(Product.group))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return _to_product_response(product)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
) -> ProductResponse:
    product = Product(**payload.model_dump())
    db.add(product)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product already exists") from exc

    await db.refresh(product)
    stmt = select(Product).where(Product.id == product.id).options(joinedload(Product.group))
    result = await db.execute(stmt)
    return _to_product_response(result.scalar_one())


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
) -> ProductResponse:
    stmt = select(Product).where(Product.id == product_id).options(joinedload(Product.group))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(product, key, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while updating product") from exc

    await db.refresh(product)
    stmt = select(Product).where(Product.id == product.id).options(joinedload(Product.group))
    result = await db.execute(stmt)
    return _to_product_response(result.scalar_one())


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
) -> None:
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    await db.delete(product)
    await db.commit()


@router.get("/products/by-qr/{qr_data}", response_model=ProductResponse)
async def get_product_by_qr(
    qr_data: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> ProductResponse:
    stmt = (
        select(Product)
        .join(ProductWarehouseSetting, ProductWarehouseSetting.product_id == Product.id)
        .where(ProductWarehouseSetting.qr_code_data == qr_data)
        .options(joinedload(Product.group))
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found for QR")
    return _to_product_response(product)


@router.get("/products/by-ean/{ean}", response_model=ProductResponse)
async def get_product_by_ean(
    ean: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> ProductResponse:
    stmt = (
        select(Product)
        .join(ProductWarehouseSetting, ProductWarehouseSetting.product_id == Product.id)
        .where(ProductWarehouseSetting.ean == ean)
        .options(joinedload(Product.group))
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found for EAN")
    return _to_product_response(product)


@router.get("/product-groups", response_model=list[ProductGroupResponse])
async def list_product_groups(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> list[ProductGroupResponse]:
    result = await db.execute(select(ProductGroup).order_by(ProductGroup.name.asc()))
    groups = list(result.scalars())
    return [_to_group_response(group) for group in groups]


@router.post("/product-groups", response_model=ProductGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_product_group(
    payload: ProductGroupCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
) -> ProductGroupResponse:
    group = ProductGroup(**payload.model_dump())
    db.add(group)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product group already exists") from exc

    await db.refresh(group)
    return _to_group_response(group)


@router.put("/product-groups/{group_id}", response_model=ProductGroupResponse)
async def update_product_group(
    group_id: int,
    payload: ProductGroupUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
) -> ProductGroupResponse:
    result = await db.execute(select(ProductGroup).where(ProductGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product group not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(group, key, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while updating group") from exc

    await db.refresh(group)
    return _to_group_response(group)
