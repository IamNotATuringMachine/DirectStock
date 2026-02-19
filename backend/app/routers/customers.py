from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.catalog import Customer, CustomerContact, CustomerLocation
from app.routers.customers_helpers import (
    _ensure_contact_location_belongs_customer,
    _get_customer_location_or_404,
    _get_customer_or_404,
    _to_contact_response,
    _to_customer_response,
    _to_location_response,
)
from app.schemas.customer import (
    CustomerContactCreate,
    CustomerContactListResponse,
    CustomerContactResponse,
    CustomerContactUpdate,
    CustomerCreate,
    CustomerListResponse,
    CustomerLocationCreate,
    CustomerLocationListResponse,
    CustomerLocationResponse,
    CustomerLocationUpdate,
    CustomerResponse,
    CustomerUpdate,
)

router = APIRouter(prefix="/api", tags=["customers"])

# Keep legacy access parity from phase2: customer read endpoints are limited
# to roles that could previously manage customer master data.
CUSTOMER_READ_PERMISSION = "module.customers.write"
CUSTOMER_WRITE_PERMISSION = "module.customers.write"


@router.get("/customers", response_model=CustomerListResponse)
async def list_customers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_READ_PERMISSION)),
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
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
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
    _=Depends(require_permissions(CUSTOMER_READ_PERMISSION)),
) -> CustomerResponse:
    item = await _get_customer_or_404(db, customer_id)
    return _to_customer_response(item)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
) -> CustomerResponse:
    item = await _get_customer_or_404(db, customer_id)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_customer_response(item)


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
) -> None:
    item = await _get_customer_or_404(db, customer_id)
    await db.delete(item)
    await db.commit()


@router.get("/customers/{customer_id}/locations", response_model=CustomerLocationListResponse)
async def list_customer_locations(
    customer_id: int,
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_READ_PERMISSION)),
) -> CustomerLocationListResponse:
    await _get_customer_or_404(db, customer_id)

    stmt = select(CustomerLocation).where(CustomerLocation.customer_id == customer_id)
    if is_active is not None:
        stmt = stmt.where(CustomerLocation.is_active == is_active)
    rows = list(
        (
            await db.execute(
                stmt.order_by(
                    CustomerLocation.is_primary.desc(),
                    CustomerLocation.name.asc(),
                    CustomerLocation.id.asc(),
                )
            )
        ).scalars()
    )
    return CustomerLocationListResponse(items=[_to_location_response(item) for item in rows])


@router.post("/customers/{customer_id}/locations", response_model=CustomerLocationResponse, status_code=status.HTTP_201_CREATED)
async def create_customer_location(
    customer_id: int,
    payload: CustomerLocationCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
) -> CustomerLocationResponse:
    await _get_customer_or_404(db, customer_id)
    item = CustomerLocation(customer_id=customer_id, **payload.model_dump())
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer location already exists") from exc
    await db.refresh(item)
    return _to_location_response(item)


@router.get("/customers/{customer_id}/locations/{location_id}", response_model=CustomerLocationResponse)
async def get_customer_location(
    customer_id: int,
    location_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_READ_PERMISSION)),
) -> CustomerLocationResponse:
    item = await _get_customer_location_or_404(db, customer_id, location_id)
    return _to_location_response(item)


@router.put("/customers/{customer_id}/locations/{location_id}", response_model=CustomerLocationResponse)
async def update_customer_location(
    customer_id: int,
    location_id: int,
    payload: CustomerLocationUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
) -> CustomerLocationResponse:
    item = await _get_customer_location_or_404(db, customer_id, location_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer location already exists") from exc
    await db.refresh(item)
    return _to_location_response(item)


@router.delete("/customers/{customer_id}/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer_location(
    customer_id: int,
    location_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
) -> None:
    item = await _get_customer_location_or_404(db, customer_id, location_id)
    await db.delete(item)
    await db.commit()


@router.get("/customers/{customer_id}/contacts", response_model=CustomerContactListResponse)
async def list_customer_contacts(
    customer_id: int,
    location_id: int | None = Query(default=None, alias="location_id"),
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_READ_PERMISSION)),
) -> CustomerContactListResponse:
    await _get_customer_or_404(db, customer_id)
    if location_id is not None:
        await _get_customer_location_or_404(db, customer_id, location_id)

    stmt = select(CustomerContact).where(CustomerContact.customer_id == customer_id)
    if location_id is not None:
        stmt = stmt.where(CustomerContact.customer_location_id == location_id)
    if is_active is not None:
        stmt = stmt.where(CustomerContact.is_active == is_active)
    rows = list(
        (
            await db.execute(
                stmt.order_by(
                    CustomerContact.is_primary.desc(),
                    CustomerContact.last_name.asc(),
                    CustomerContact.first_name.asc(),
                    CustomerContact.id.asc(),
                )
            )
        ).scalars()
    )
    return CustomerContactListResponse(items=[_to_contact_response(item) for item in rows])


@router.post("/customers/{customer_id}/contacts", response_model=CustomerContactResponse, status_code=status.HTTP_201_CREATED)
async def create_customer_contact(
    customer_id: int,
    payload: CustomerContactCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
) -> CustomerContactResponse:
    await _get_customer_or_404(db, customer_id)
    await _ensure_contact_location_belongs_customer(
        db,
        customer_id=customer_id,
        customer_location_id=payload.customer_location_id,
    )

    item = CustomerContact(customer_id=customer_id, **payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_contact_response(item)


@router.put("/customers/{customer_id}/contacts/{contact_id}", response_model=CustomerContactResponse)
async def update_customer_contact(
    customer_id: int,
    contact_id: int,
    payload: CustomerContactUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
) -> CustomerContactResponse:
    await _get_customer_or_404(db, customer_id)
    item = (
        await db.execute(
            select(CustomerContact).where(
                CustomerContact.id == contact_id,
                CustomerContact.customer_id == customer_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer contact not found")

    updates = payload.model_dump(exclude_unset=True)
    await _ensure_contact_location_belongs_customer(
        db,
        customer_id=customer_id,
        customer_location_id=updates.get("customer_location_id"),
    )
    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_contact_response(item)


@router.delete("/customers/{customer_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer_contact(
    customer_id: int,
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(CUSTOMER_WRITE_PERMISSION)),
) -> None:
    await _get_customer_or_404(db, customer_id)
    item = (
        await db.execute(
            select(CustomerContact).where(
                CustomerContact.id == contact_id,
                CustomerContact.customer_id == customer_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer contact not found")

    await db.delete(item)
    await db.commit()
