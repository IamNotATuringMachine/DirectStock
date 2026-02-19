from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Customer, CustomerContact, CustomerLocation
from app.schemas.customer import CustomerContactResponse, CustomerLocationResponse, CustomerResponse


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


def _to_location_response(item: CustomerLocation) -> CustomerLocationResponse:
    return CustomerLocationResponse(
        id=item.id,
        customer_id=item.customer_id,
        location_code=item.location_code,
        name=item.name,
        phone=item.phone,
        email=item.email,
        street=item.street,
        house_number=item.house_number,
        address_line2=item.address_line2,
        postal_code=item.postal_code,
        city=item.city,
        country_code=item.country_code,
        is_primary=item.is_primary,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_contact_response(item: CustomerContact) -> CustomerContactResponse:
    return CustomerContactResponse(
        id=item.id,
        customer_id=item.customer_id,
        customer_location_id=item.customer_location_id,
        job_title=item.job_title,
        salutation=item.salutation,
        first_name=item.first_name,
        last_name=item.last_name,
        phone=item.phone,
        email=item.email,
        is_primary=item.is_primary,
        is_active=item.is_active,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _get_customer_or_404(db: AsyncSession, customer_id: int) -> Customer:
    item = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return item


async def _get_customer_location_or_404(db: AsyncSession, customer_id: int, location_id: int) -> CustomerLocation:
    item = (
        await db.execute(
            select(CustomerLocation).where(
                CustomerLocation.id == location_id,
                CustomerLocation.customer_id == customer_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer location not found")
    return item


async def _ensure_contact_location_belongs_customer(
    db: AsyncSession,
    *,
    customer_id: int,
    customer_location_id: int | None,
) -> None:
    if customer_location_id is None:
        return
    location = (
        await db.execute(
            select(CustomerLocation.id).where(
                CustomerLocation.id == customer_location_id,
                CustomerLocation.customer_id == customer_id,
            )
        )
    ).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer location not found")
