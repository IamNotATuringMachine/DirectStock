from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.phase5_utils import auth_headers, create_base_price, create_customer, create_product, suffix


async def _create_sales_order(client: AsyncClient, admin_token: str, marker: str) -> int:
    product_id = await create_product(client, admin_token, marker)
    customer_id = await create_customer(client, admin_token, marker)
    await create_base_price(client, admin_token, product_id=product_id, net_price="15.00", vat_rate="19")

    response = await client.post(
        "/api/sales-orders",
        headers=auth_headers(admin_token),
        json={
            "customer_id": customer_id,
            "currency": "EUR",
            "items": [
                {
                    "item_type": "product",
                    "product_id": product_id,
                    "quantity": "2",
                    "unit": "piece",
                }
            ],
        },
    )
    assert response.status_code == 201
    return int(response.json()["order"]["id"])


@pytest.mark.asyncio
async def test_idempotent_replay_for_sales_order_create(client: AsyncClient, admin_token: str):
    marker = f"P5OFFSO-{suffix()}"
    product_id = await create_product(client, admin_token, marker)
    customer_id = await create_customer(client, admin_token, marker)
    await create_base_price(client, admin_token, product_id=product_id, net_price="15.00", vat_rate="19")

    headers = {**auth_headers(admin_token), "X-Client-Operation-Id": f"op-{uuid4().hex[:10]}"}
    payload = {
        "customer_id": customer_id,
        "currency": "EUR",
        "items": [
            {
                "item_type": "product",
                "product_id": product_id,
                "quantity": "2",
                "unit": "piece",
            }
        ],
    }

    first = await client.post("/api/sales-orders", headers=headers, json=payload)
    second = await client.post("/api/sales-orders", headers=headers, json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["order"]["id"] == second.json()["order"]["id"]


@pytest.mark.asyncio
async def test_idempotent_replay_for_invoice_create(client: AsyncClient, admin_token: str):
    order_id = await _create_sales_order(client, admin_token, f"P5OFFINV-{suffix()}")
    headers = {**auth_headers(admin_token), "X-Client-Operation-Id": f"op-{uuid4().hex[:10]}"}

    first = await client.post("/api/invoices", headers=headers, json={"sales_order_id": order_id})
    second = await client.post("/api/invoices", headers=headers, json={"sales_order_id": order_id})
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["invoice"]["id"] == second.json()["invoice"]["id"]
