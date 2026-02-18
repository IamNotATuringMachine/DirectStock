from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from tests.phase5_utils import auth_headers, create_base_price, create_customer, create_product, suffix


@pytest.mark.asyncio
async def test_base_price_and_resolve(client: AsyncClient, admin_token: str):
    token_headers = auth_headers(admin_token)
    product_id = await create_product(client, admin_token, f"P5PR-{suffix()}")
    await create_base_price(client, admin_token, product_id=product_id, net_price="100.00", vat_rate="19")

    list_response = await client.get(f"/api/pricing/products/{product_id}/base-prices", headers=token_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) >= 1

    resolve = await client.get(
        "/api/pricing/resolve",
        headers=token_headers,
        params={"product_id": product_id},
    )
    assert resolve.status_code == 200
    assert resolve.json()["source"] == "base"
    assert resolve.json()["gross_price"] == "119.00"


@pytest.mark.asyncio
async def test_customer_price_overlap_conflict(client: AsyncClient, admin_token: str):
    token_headers = auth_headers(admin_token)
    marker = f"P5CP-{suffix()}"
    product_id = await create_product(client, admin_token, marker)
    customer_id = await create_customer(client, admin_token, marker)

    valid_from = datetime.now(UTC).replace(microsecond=0).isoformat()
    first = await client.put(
        f"/api/pricing/customers/{customer_id}/product-prices/{product_id}",
        headers=token_headers,
        json={
            "net_price": "89.50",
            "vat_rate": "19",
            "currency": "EUR",
            "valid_from": valid_from,
            "valid_to": None,
            "is_active": True,
        },
    )
    assert first.status_code == 200

    second = await client.put(
        f"/api/pricing/customers/{customer_id}/product-prices/{product_id}",
        headers=token_headers,
        json={
            "net_price": "79.50",
            "vat_rate": "19",
            "currency": "EUR",
            "valid_from": valid_from,
            "valid_to": None,
            "is_active": True,
        },
    )
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_pricing_vat_validation(client: AsyncClient, admin_token: str):
    product_id = await create_product(client, admin_token, f"P5VAT-{suffix()}")
    invalid = await client.post(
        f"/api/pricing/products/{product_id}/base-prices",
        headers=auth_headers(admin_token),
        json={
            "net_price": "10.00",
            "vat_rate": "5",
            "currency": "EUR",
            "valid_from": datetime.now(UTC).isoformat(),
            "is_active": True,
        },
    )
    assert invalid.status_code == 422
