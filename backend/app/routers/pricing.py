from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.catalog import Customer, Product
from app.models.phase5 import CustomerProductPrice, ProductBasePrice
from app.schemas.phase5 import (
    CustomerProductPriceListResponse,
    CustomerProductPriceResponse,
    CustomerProductPriceUpsert,
    ProductBasePriceCreate,
    ProductBasePriceListResponse,
    ProductBasePriceResponse,
    ResolvedPriceResponse,
)

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

_ALLOWED_VAT = {Decimal("0"), Decimal("7"), Decimal("19")}


def _now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _normalize_vat_rate(value: Decimal) -> Decimal:
    normalized = value.quantize(Decimal("0.01"))
    if normalized not in _ALLOWED_VAT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="vat_rate must be one of 0, 7, 19",
        )
    return normalized


def _gross(net: Decimal, vat_rate: Decimal) -> Decimal:
    return (net * (Decimal("1") + vat_rate / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _intervals_overlap(
    start_a: datetime,
    end_a: datetime | None,
    start_b: datetime,
    end_b: datetime | None,
) -> bool:
    normalized_start_a = _as_utc(start_a)
    normalized_start_b = _as_utc(start_b)
    effective_end_a = _as_utc(end_a) if end_a is not None else datetime.max.replace(tzinfo=UTC)
    effective_end_b = _as_utc(end_b) if end_b is not None else datetime.max.replace(tzinfo=UTC)
    return normalized_start_a <= effective_end_b and normalized_start_b <= effective_end_a


def _to_base_price_response(item: ProductBasePrice) -> ProductBasePriceResponse:
    return ProductBasePriceResponse(
        id=item.id,
        product_id=item.product_id,
        net_price=Decimal(item.net_price),
        vat_rate=Decimal(item.vat_rate),
        gross_price=_gross(Decimal(item.net_price), Decimal(item.vat_rate)),
        currency=item.currency,
        valid_from=item.valid_from,
        valid_to=item.valid_to,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_customer_price_response(item: CustomerProductPrice) -> CustomerProductPriceResponse:
    return CustomerProductPriceResponse(
        id=item.id,
        customer_id=item.customer_id,
        product_id=item.product_id,
        net_price=Decimal(item.net_price),
        vat_rate=Decimal(item.vat_rate),
        gross_price=_gross(Decimal(item.net_price), Decimal(item.vat_rate)),
        currency=item.currency,
        valid_from=item.valid_from,
        valid_to=item.valid_to,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/products/{product_id}/base-prices", response_model=ProductBasePriceListResponse)
async def list_product_base_prices(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.pricing.read")),
) -> ProductBasePriceListResponse:
    product = (await db.execute(select(Product.id).where(Product.id == product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    rows = list(
        (
            await db.execute(
                select(ProductBasePrice)
                .where(ProductBasePrice.product_id == product_id)
                .order_by(ProductBasePrice.valid_from.desc().nullslast(), ProductBasePrice.id.desc())
            )
        ).scalars()
    )
    return ProductBasePriceListResponse(items=[_to_base_price_response(row) for row in rows])


@router.post("/products/{product_id}/base-prices", response_model=ProductBasePriceResponse, status_code=status.HTTP_201_CREATED)
async def create_product_base_price(
    product_id: int,
    payload: ProductBasePriceCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.pricing.write")),
) -> ProductBasePriceResponse:
    product = (await db.execute(select(Product.id).where(Product.id == product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if payload.valid_from and payload.valid_to and payload.valid_to < payload.valid_from:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="valid_to must be >= valid_from")

    vat_rate = _normalize_vat_rate(payload.vat_rate)

    row = ProductBasePrice(
        product_id=product_id,
        net_price=payload.net_price,
        vat_rate=vat_rate,
        currency=payload.currency.upper(),
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_base_price_response(row)


@router.get("/customers/{customer_id}/product-prices", response_model=CustomerProductPriceListResponse)
async def list_customer_product_prices(
    customer_id: int,
    product_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.pricing.read")),
) -> CustomerProductPriceListResponse:
    customer = (await db.execute(select(Customer.id).where(Customer.id == customer_id))).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    stmt = select(CustomerProductPrice).where(CustomerProductPrice.customer_id == customer_id)
    if product_id is not None:
        stmt = stmt.where(CustomerProductPrice.product_id == product_id)

    rows = list((await db.execute(stmt.order_by(CustomerProductPrice.valid_from.desc(), CustomerProductPrice.id.desc()))).scalars())
    return CustomerProductPriceListResponse(items=[_to_customer_price_response(row) for row in rows])


@router.put("/customers/{customer_id}/product-prices/{product_id}", response_model=CustomerProductPriceResponse)
async def upsert_customer_product_price(
    customer_id: int,
    product_id: int,
    payload: CustomerProductPriceUpsert,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.pricing.write")),
) -> CustomerProductPriceResponse:
    customer = (await db.execute(select(Customer.id).where(Customer.id == customer_id))).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    product = (await db.execute(select(Product.id).where(Product.id == product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if payload.valid_to and payload.valid_to < payload.valid_from:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="valid_to must be >= valid_from")

    vat_rate = _normalize_vat_rate(payload.vat_rate)

    existing = list(
        (
            await db.execute(
                select(CustomerProductPrice).where(
                    CustomerProductPrice.customer_id == customer_id,
                    CustomerProductPrice.product_id == product_id,
                    CustomerProductPrice.currency == payload.currency.upper(),
                    CustomerProductPrice.is_active.is_(True),
                )
            )
        ).scalars()
    )

    for row in existing:
        if _intervals_overlap(payload.valid_from, payload.valid_to, row.valid_from, row.valid_to):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer price period overlaps with existing entry",
            )

    row = CustomerProductPrice(
        customer_id=customer_id,
        product_id=product_id,
        net_price=payload.net_price,
        vat_rate=vat_rate,
        currency=payload.currency.upper(),
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_customer_price_response(row)


@router.get("/resolve", response_model=ResolvedPriceResponse)
async def resolve_price(
    product_id: int,
    customer_id: int | None = None,
    at: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.pricing.read")),
) -> ResolvedPriceResponse:
    at = at or _now()

    if customer_id is not None:
        customer_row = (
            await db.execute(
                select(CustomerProductPrice)
                .where(
                    CustomerProductPrice.customer_id == customer_id,
                    CustomerProductPrice.product_id == product_id,
                    CustomerProductPrice.is_active.is_(True),
                    CustomerProductPrice.valid_from <= at,
                    or_(CustomerProductPrice.valid_to.is_(None), CustomerProductPrice.valid_to >= at),
                )
                .order_by(CustomerProductPrice.valid_from.desc(), CustomerProductPrice.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if customer_row is not None:
            net = Decimal(customer_row.net_price)
            vat_rate = Decimal(customer_row.vat_rate)
            return ResolvedPriceResponse(
                source="customer",
                net_price=net,
                vat_rate=vat_rate,
                gross_price=_gross(net, vat_rate),
                currency=customer_row.currency,
            )

    base_row = (
        await db.execute(
            select(ProductBasePrice)
            .where(
                ProductBasePrice.product_id == product_id,
                ProductBasePrice.is_active.is_(True),
                or_(ProductBasePrice.valid_from.is_(None), ProductBasePrice.valid_from <= at),
                or_(ProductBasePrice.valid_to.is_(None), ProductBasePrice.valid_to >= at),
            )
            .order_by(ProductBasePrice.valid_from.desc().nullslast(), ProductBasePrice.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if base_row is not None:
        net = Decimal(base_row.net_price)
        vat_rate = Decimal(base_row.vat_rate)
        return ResolvedPriceResponse(
            source="base",
            net_price=net,
            vat_rate=vat_rate,
            gross_price=_gross(net, vat_rate),
            currency=base_row.currency,
        )

    return ResolvedPriceResponse(source="none", net_price=None, vat_rate=None, gross_price=None, currency=None)
