from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.phase5_utils import (
    auth_headers,
    create_base_price,
    create_customer,
    create_product,
    suffix,
)


@pytest.mark.asyncio
async def test_sales_order_with_product_items(client: AsyncClient, admin_token: str):
    marker = f"P5SO-{suffix()}"
    product_id = await create_product(client, admin_token, marker)
    customer_id = await create_customer(client, admin_token, marker)
    await create_base_price(client, admin_token, product_id=product_id, net_price="50.00", vat_rate="19")

    created = await client.post(
        "/api/sales-orders",
        headers=auth_headers(admin_token),
        json={
            "customer_id": customer_id,
            "currency": "EUR",
            "notes": "phase5 sales test",
            "items": [
                {
                    "item_type": "product",
                    "product_id": product_id,
                    "quantity": "2",
                    "unit": "piece",
                },
            ],
        },
    )
    assert created.status_code == 201
    payload = created.json()
    assert payload["order"]["customer_id"] == customer_id
    assert len(payload["items"]) == 1
    assert {item["item_type"] for item in payload["items"]} == {"product"}

    added = await client.post(
        f"/api/sales-orders/{payload['order']['id']}/items",
        headers=auth_headers(admin_token),
        json={
            "item_type": "product",
            "product_id": product_id,
            "quantity": "1",
            "unit": "piece",
        },
    )
    assert added.status_code == 201
    assert added.json()["item_type"] == "product"


@pytest.mark.asyncio
async def test_sales_order_rejects_service_item_type(client: AsyncClient, admin_token: str):
    marker = f"P5SO-NEG-{suffix()}"
    product_id = await create_product(client, admin_token, marker)
    customer_id = await create_customer(client, admin_token, marker)
    await create_base_price(client, admin_token, product_id=product_id, net_price="50.00", vat_rate="19")

    invalid = await client.post(
        "/api/sales-orders",
        headers=auth_headers(admin_token),
        json={
            "customer_id": customer_id,
            "currency": "EUR",
            "items": [
                {
                    "item_type": "service",
                    "product_id": product_id,
                    "quantity": "1",
                    "unit": "piece",
                }
            ],
        },
    )
    assert invalid.status_code == 422


@pytest.mark.asyncio
async def test_sales_order_idempotent_create(client: AsyncClient, admin_token: str):
    marker = f"P5ID-{suffix()}"
    product_id = await create_product(client, admin_token, marker)
    customer_id = await create_customer(client, admin_token, marker)
    await create_base_price(client, admin_token, product_id=product_id, net_price="30.00", vat_rate="19")

    operation_id = f"op-{uuid4().hex[:10]}"
    headers = {**auth_headers(admin_token), "X-Client-Operation-Id": operation_id}
    payload = {
        "customer_id": customer_id,
        "currency": "EUR",
        "items": [
            {
                "item_type": "product",
                "product_id": product_id,
                "quantity": "1",
                "unit": "piece",
            }
        ],
    }

    first = await client.post("/api/sales-orders", headers=headers, json=payload)
    second = await client.post("/api/sales-orders", headers=headers, json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["order"]["id"] == second.json()["order"]["id"]
