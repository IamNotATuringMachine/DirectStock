import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_can_list_users(client: AsyncClient, admin_token: str):
    response = await client.get("/api/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.asyncio
async def test_non_admin_forbidden(client: AsyncClient, admin_token: str):
    create = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "worker",
            "email": "worker@example.com",
            "full_name": "Worker",
            "password": "WorkerPass123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create.status_code == 201

    worker_login = await client.post(
        "/api/auth/login",
        json={"username": "worker", "password": "WorkerPass123!"},
    )
    worker_token = worker_login.json()["access_token"]

    forbidden = await client.get("/api/users", headers={"Authorization": f"Bearer {worker_token}"})
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_user_crud_and_password_change(client: AsyncClient, admin_token: str):
    create = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "manager",
            "email": "manager@example.com",
            "full_name": "Warehouse Manager",
            "password": "ManagerPass123!",
            "roles": ["lagerleiter"],
            "is_active": True,
        },
    )
    assert create.status_code == 201
    created_user = create.json()

    update = await client.put(
        f"/api/users/{created_user['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"full_name": "Updated Manager", "roles": ["lagerleiter", "lagermitarbeiter"]},
    )
    assert update.status_code == 200
    assert update.json()["full_name"] == "Updated Manager"

    password_change = await client.patch(
        f"/api/users/{created_user['id']}/password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"new_password": "NewManagerPass123!"},
    )
    assert password_change.status_code == 200

    login_new_password = await client.post(
        "/api/auth/login",
        json={"username": "manager", "password": "NewManagerPass123!"},
    )
    assert login_new_password.status_code == 200

    delete = await client.delete(
        f"/api/users/{created_user['id']}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert delete.status_code == 200


@pytest.mark.asyncio
async def test_phase2_roles_can_be_assigned(client: AsyncClient, admin_token: str):
    create = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "phase2roles",
            "email": "phase2roles@example.com",
            "full_name": "Phase2 Roles",
            "password": "Phase2Roles123!",
            "roles": ["einkauf", "versand", "controller"],
            "is_active": True,
        },
    )
    assert create.status_code == 201
    payload = create.json()
    assert sorted(payload["roles"]) == ["controller", "einkauf", "versand"]
