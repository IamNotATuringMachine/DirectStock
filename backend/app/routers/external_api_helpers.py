from datetime import UTC, datetime
from secrets import token_hex

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Customer, CustomerLocation
from app.models.phase4 import IntegrationAccessLog, IntegrationClient


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


async def _resolve_customer_scope(
    db: AsyncSession,
    *,
    customer_id: int | None,
    customer_location_id: int | None,
) -> tuple[int | None, int | None]:
    if customer_location_id is None:
        if customer_id is None:
            return None, None
        customer = (await db.execute(select(Customer.id).where(Customer.id == customer_id))).scalar_one_or_none()
        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return customer_id, None

    location = (
        await db.execute(select(CustomerLocation).where(CustomerLocation.id == customer_location_id))
    ).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer location not found")

    resolved_customer_id = int(location.customer_id)
    if customer_id is not None and customer_id != resolved_customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer location does not belong to selected customer",
        )

    return resolved_customer_id, customer_location_id


async def _log_access(
    db: AsyncSession,
    *,
    request: Request,
    client: IntegrationClient | None,
    scope: str | None,
    status_code: int,
    error_message: str | None,
) -> None:
    db.add(
        IntegrationAccessLog(
            integration_client_id=client.id if client else None,
            endpoint=request.url.path,
            method=request.method,
            scope=scope,
            status_code=status_code,
            request_id=getattr(request.state, "request_id", None),
            ip_address=request.client.host if request.client else None,
            error_message=error_message,
        )
    )
    await db.commit()
