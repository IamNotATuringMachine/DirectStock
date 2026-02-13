from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_roles
from app.models.catalog import Customer
from app.schemas.customer import CustomerCreate, CustomerListResponse, CustomerResponse, CustomerUpdate

router = APIRouter(prefix="/api", tags=["customers"])


def _to_customer_response(item: Customer) -> CustomerResponse:
    return CustomerResponse(
        id=item.id,
        customer_number=item.customer_number,
        company_name=item.company_name,
        contact_name=item.contact_name,
        email=item.email,
        phone=item.phone,
        billing_address=item.billing_address,
        shipping_address=item.shipping_address,
        payment_terms=item.payment_terms,
        delivery_terms=item.delivery_terms,
        credit_limit=item.credit_limit,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/customers", response_model=CustomerListResponse)
async def list_customers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> CustomerListResponse:
    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Customer.customer_number.ilike(term),
                Customer.company_name.ilike(term),
                Customer.contact_name.ilike(term),
            )
        )
    if is_active is not None:
        filters.append(Customer.is_active == is_active)

    count_stmt = select(func.count(Customer.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(Customer).order_by(Customer.customer_number.asc()).offset((page - 1) * page_size).limit(page_size)
    if filters:
        stmt = stmt.where(*filters)

    rows = list((await db.execute(stmt)).scalars())
    return CustomerListResponse(
        items=[_to_customer_response(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "versand")),
) -> CustomerResponse:
    item = Customer(**payload.model_dump())
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer already exists") from exc

    await db.refresh(item)
    return _to_customer_response(item)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> CustomerResponse:
    item = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return _to_customer_response(item)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "versand")),
) -> CustomerResponse:
    item = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_customer_response(item)


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "lagerleiter", "versand")),
) -> None:
    item = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    await db.delete(item)
    await db.commit()
