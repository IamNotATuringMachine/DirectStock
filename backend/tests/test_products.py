import pytest
from httpx import AsyncClient
from uuid import uuid4


async def _create_group(client: AsyncClient, admin_token: str, name: str) -> int:
    response = await client.post(
        "/api/product-groups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": name, "description": "Hardware products"},
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _create_bin(client: AsyncClient, admin_token: str, prefix: str) -> int:
    warehouse = await client.post(
        "/api/warehouses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-WH", "name": f"{prefix} Warehouse", "is_active": True},
    )
    assert warehouse.status_code == 201

    zone = await client.post(
        f"/api/warehouses/{warehouse.json()['id']}/zones",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-ZONE", "name": "Storage", "zone_type": "storage", "is_active": True},
    )
    assert zone.status_code == 201

    bin_location = await client.post(
        f"/api/zones/{zone.json()['id']}/bins",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": f"{prefix}-BIN", "bin_type": "storage", "is_active": True},
    )
    assert bin_location.status_code == 201
    return bin_location.json()["id"]


@pytest.mark.asyncio
async def test_product_group_crud(client: AsyncClient, admin_token: str):
    group_id = await _create_group(client, admin_token, "Hardware-A")

    list_response = await client.get("/api/product-groups", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_response.status_code == 200
    assert any(group["id"] == group_id for group in list_response.json())

    update = await client.put(
        f"/api/product-groups/{group_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"description": "Updated"},
    )
    assert update.status_code == 200
    assert update.json()["description"] == "Updated"


@pytest.mark.asyncio
async def test_product_crud_and_search(client: AsyncClient, admin_token: str):
    group_id = await _create_group(client, admin_token, "Hardware-B")

    create = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": "ART-100",
            "name": "Lagerbox",
            "description": "Blue storage box",
            "product_group_id": group_id,
            "unit": "piece",
            "status": "active",
        },
    )
    assert create.status_code == 201
    product_id = create.json()["id"]

    list_response = await client.get(
        "/api/products?search=Lagerbox&group_id={group_id}&status=active".format(group_id=group_id),
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["total"] >= 1
    assert any(item["id"] == product_id for item in payload["items"])

    detail = await client.get(
        f"/api/products/{product_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert detail.status_code == 200

    update = await client.put(
        f"/api/products/{product_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Lagerbox XL", "status": "blocked"},
    )
    assert update.status_code == 200
    assert update.json()["name"] == "Lagerbox XL"
    assert update.json()["status"] == "blocked"

    delete = await client.delete(
        f"/api/products/{product_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert delete.status_code == 204


@pytest.mark.asyncio
async def test_non_admin_cannot_mutate_products(client: AsyncClient, admin_token: str):
    create_worker = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "picker",
            "email": "picker@example.com",
            "full_name": "Picker",
            "password": "PickerPass123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create_worker.status_code == 201

    worker_login = await client.post(
        "/api/auth/login", json={"username": "picker", "password": "PickerPass123!"}
    )
    worker_token = worker_login.json()["access_token"]

    forbidden = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={
            "product_number": "ART-200",
            "name": "Forbidden",
            "unit": "piece",
            "status": "active",
        },
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_product_default_bin_roundtrip(client: AsyncClient, admin_token: str):
    suffix = uuid4().hex[:8].upper()
    group_id = await _create_group(client, admin_token, f"Hardware-{suffix}")
    default_bin_id = await _create_bin(client, admin_token, f"PRDBIN-{suffix}")

    create = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "product_number": f"ART-300-{suffix}",
            "name": "Default Bin Product",
            "product_group_id": group_id,
            "unit": "piece",
            "status": "active",
            "default_bin_id": default_bin_id,
        },
    )
    assert create.status_code == 201
    product_id = create.json()["id"]
    assert create.json()["default_bin_id"] == default_bin_id

    detail = await client.get(
        f"/api/products/{product_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert detail.status_code == 200
    assert detail.json()["default_bin_id"] == default_bin_id

    update = await client.put(
        f"/api/products/{product_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"default_bin_id": None},
    )
    assert update.status_code == 200
    assert update.json()["default_bin_id"] is None
