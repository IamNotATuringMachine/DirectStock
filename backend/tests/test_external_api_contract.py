from uuid import uuid4

import pytest
from httpx import AsyncClient


def _suffix() -> str:
    return uuid4().hex[:8].upper()


async def _create_master_data(client: AsyncClient, admin_token: str, prefix: str) -> dict[str, int]:
    group = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"{prefix}-GROUP", "description": "External API group"},
    )
    assert group.status_code == 201

    product = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"{prefix}-ART-001",
            "name": f"{prefix} Product",
            "description": "External API test",
            "product_group_id": group.json()["id"],
            "unit": "piece",
            "status": "active",
        },
    )
    assert product.status_code == 201

    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-WH", "name": f"Warehouse {prefix}", "address": "Test", "is_active": True},
    )
    assert warehouse.status_code == 201

    zone = await client.post(
        f"/api/warehouses/{warehouse.json()['id']}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-Z", "name": "Zone", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    bin_row = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-BIN", "bin_type": "storage", "is_active": True},
    )
    assert bin_row.status_code == 201

    return {
        "product_id": product.json()["id"],
        "warehouse_id": warehouse.json()["id"],
        "bin_id": bin_row.json()["id"],
    }


async def _external_token(client: AsyncClient, admin_token: str) -> str:
    create = await client.post(
        "/api/integration-clients",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"ext-{_suffix()}",
            "client_id": f"ext-client-{_suffix()}",
            "scopes": [
                "products:read",
                "warehouses:read",
                "inventory:read",
                "movements:read",
                "shipments:read",
                "orders:write",
            ],
        },
    )
    assert create.status_code == 201
    create_payload = create.json()

    token = await client.post(
        "/api/external/token",
        json={
            "client_id": create_payload["client"]["client_id"],
            "client_secret": create_payload["client_secret"],
        },
    )
    assert token.status_code == 200
    return token.json()["access_token"]


@pytest.mark.asyncio
async def test_external_read_and_write_contracts(client: AsyncClient, admin_token: str):
    prefix = f"EXT-{_suffix()}"
    data = await _create_master_data(client, admin_token, prefix)
    token = await _external_token(client, admin_token)
    headers = {"Authorization": f"Bearer {token}"}

    products = await client.get("/api/external/v1/products", headers=headers)
    assert products.status_code == 200
    assert any(item["id"] == data["product_id"] for item in products.json())

    warehouses = await client.get("/api/external/v1/warehouses", headers=headers)
    assert warehouses.status_code == 200
    assert any(item["id"] == data["warehouse_id"] for item in warehouses.json())

    inventory = await client.get("/api/external/v1/inventory", headers=headers)
    assert inventory.status_code == 200

    movements = await client.get("/api/external/v1/movements", headers=headers)
    assert movements.status_code == 200

    create_po = await client.post(
        "/api/external/v1/commands/purchase-orders",
        headers=headers,
        json={
            "notes": "external command",
            "items": [
                {
                    "product_id": data["product_id"],
                    "ordered_quantity": "5",
                    "unit": "piece",
                }
            ],
        },
    )
    assert create_po.status_code == 201
    assert create_po.json()["status"] == "draft"

    create_issue = await client.post(
        "/api/external/v1/commands/goods-issues",
        headers=headers,
        json={
            "notes": "external issue command",
            "items": [
                {
                    "product_id": data["product_id"],
                    "requested_quantity": "1",
                    "unit": "piece",
                    "source_bin_id": data["bin_id"],
                }
            ],
        },
    )
    assert create_issue.status_code == 201
    assert create_issue.json()["status"] == "draft"
