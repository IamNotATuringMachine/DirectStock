from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_roles
from app.models.catalog import Product, ProductSupplier, Supplier
from app.schemas.supplier import (
    ProductSupplierCreate,
    ProductSupplierResponse,
    ProductSupplierUpdate,
    SupplierCreate,
    SupplierListResponse,
    SupplierResponse,
    SupplierUpdate,
)

router = APIRouter(prefix="/api", tags=["suppliers"])

SUPPLIER_ROLES = ("admin", "lagerleiter", "einkauf")


def _to_supplier_response(item: Supplier) -> SupplierResponse:
    return SupplierResponse(
        id=item.id,
        supplier_number=item.supplier_number,
        company_name=item.company_name,
        contact_name=item.contact_name,
        email=item.email,
        phone=item.phone,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_product_supplier_response(item: ProductSupplier) -> ProductSupplierResponse:
    return ProductSupplierResponse(
        id=item.id,
        product_id=item.product_id,
        supplier_id=item.supplier_id,
        supplier_product_number=item.supplier_product_number,
        price=item.price,
        lead_time_days=item.lead_time_days,
        min_order_quantity=item.min_order_quantity,
        is_preferred=item.is_preferred,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/suppliers", response_model=SupplierListResponse)
async def list_suppliers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> SupplierListResponse:
    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Supplier.supplier_number.ilike(term),
                Supplier.company_name.ilike(term),
                Supplier.contact_name.ilike(term),
            )
        )
    if is_active is not None:
        filters.append(Supplier.is_active == is_active)

    count_stmt = select(func.count(Supplier.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(Supplier).order_by(Supplier.supplier_number.asc()).offset((page - 1) * page_size).limit(page_size)
    if filters:
        stmt = stmt.where(*filters)

    rows = list((await db.execute(stmt)).scalars())
    return SupplierListResponse(
        items=[_to_supplier_response(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> SupplierResponse:
    item = Supplier(**payload.model_dump())
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supplier already exists") from exc

    await db.refresh(item)
    return _to_supplier_response(item)


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> SupplierResponse:
    item = (await db.execute(select(Supplier).where(Supplier.id == supplier_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return _to_supplier_response(item)


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> SupplierResponse:
    item = (await db.execute(select(Supplier).where(Supplier.id == supplier_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_supplier_response(item)


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> None:
    item = (await db.execute(select(Supplier).where(Supplier.id == supplier_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    await db.delete(item)
    await db.commit()


@router.get("/products/{product_id}/suppliers", response_model=list[ProductSupplierResponse])
async def list_product_suppliers(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> list[ProductSupplierResponse]:
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    rows = list(
        (
            await db.execute(
                select(ProductSupplier)
                .where(ProductSupplier.product_id == product_id)
                .order_by(ProductSupplier.is_preferred.desc(), ProductSupplier.id.asc())
            )
        ).scalars()
    )
    return [_to_product_supplier_response(item) for item in rows]


@router.post("/products/{product_id}/suppliers", response_model=ProductSupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_product_supplier(
    product_id: int,
    payload: ProductSupplierCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> ProductSupplierResponse:
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    supplier = (await db.execute(select(Supplier).where(Supplier.id == payload.supplier_id))).scalar_one_or_none()
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    item = ProductSupplier(product_id=product_id, **payload.model_dump())
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product supplier relation already exists") from exc

    await db.refresh(item)
    return _to_product_supplier_response(item)


@router.put("/products/{product_id}/suppliers/{relation_id}", response_model=ProductSupplierResponse)
async def update_product_supplier(
    product_id: int,
    relation_id: int,
    payload: ProductSupplierUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> ProductSupplierResponse:
    item = (
        await db.execute(
            select(ProductSupplier).where(
                ProductSupplier.id == relation_id,
                ProductSupplier.product_id == product_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product supplier relation not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_product_supplier_response(item)


@router.delete("/products/{product_id}/suppliers/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_supplier(
    product_id: int,
    relation_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*SUPPLIER_ROLES)),
) -> None:
    item = (
        await db.execute(
            select(ProductSupplier).where(
                ProductSupplier.id == relation_id,
                ProductSupplier.product_id == product_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product supplier relation not found")

    await db.delete(item)
    await db.commit()
