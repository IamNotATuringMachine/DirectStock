from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from httpx import AsyncClient


def suffix() -> str:
    return uuid4().hex[:8].upper()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def create_product(client: AsyncClient, admin_token: str, prefix: str) -> int:
    group = await client.post(
        "/api/product-groups",
        headers=auth_headers(admin_token),
        json={"name": f"{prefix}-GROUP", "description": "Phase5 group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers=auth_headers(admin_token),
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "Phase5 test product",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201
    return int(product.json()["id"])


async def create_customer(client: AsyncClient, admin_token: str, prefix: str) -> int:
    response = await client.post(
        "/api/customers",
        headers=auth_headers(admin_token),
        json={
            "customer_number": f"{prefix}-CUS",
            "company_name": f"Customer {prefix}",
            "contact_name": f"Contact {prefix}",
            "is_active": True,
        },
    )
    assert response.status_code == 201
    return int(response.json()["id"])


async def create_service(client: AsyncClient, admin_token: str, prefix: str) -> int:
    response = await client.post(
        "/api/services",
        headers=auth_headers(admin_token),
        json={
            "service_number": f"{prefix}-SRV",
            "name": f"Service {prefix}",
            "description": "Phase5 test service",
            "net_price": "35.00",
            "vat_rate": "19",
            "currency": "EUR",
            "status": "active",
        },
    )
    assert response.status_code == 201
    return int(response.json()["id"])


async def create_base_price(
    client: AsyncClient,
    admin_token: str,
    *,
    product_id: int,
    net_price: str = "100.00",
    vat_rate: str = "19",
) -> None:
    response = await client.post(
        f"/api/pricing/products/{product_id}/base-prices",
        headers=auth_headers(admin_token),
        json={
            "net_price": net_price,
            "vat_rate": vat_rate,
            "currency": "EUR",
            "valid_from": datetime.now(UTC).isoformat(),
            "is_active": True,
        },
    )
    assert response.status_code == 201

