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


@pytest.mark.asyncio
async def test_managed_only_filter_excludes_seed_users(client: AsyncClient, admin_token: str):
    marker = "managed-only-visible-user"
    create = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": marker,
            "email": f"{marker}@example.com",
            "full_name": "Managed Visible User",
            "password": "ManagedVisible123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create.status_code == 201

    response = await client.get(
        "/api/users?managed_only=true",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    usernames = {item["username"] for item in response.json()["items"]}
    assert marker in usernames
    assert "admin" not in usernames
    assert "lagerleiter" not in usernames
    assert "lagermitarbeiter" not in usernames


@pytest.mark.asyncio
async def test_user_access_profile_flow_and_validation(client: AsyncClient, admin_token: str):
    username = "access-profile-user"
    password = "AccessProfile123!"

    create = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": "Access Profile User",
            "password": password,
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert create.status_code == 201
    user_id = create.json()["id"]

    initial_profile = await client.get(
        f"/api/users/{user_id}/access-profile",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert initial_profile.status_code == 200
    assert initial_profile.json()["allow_permissions"] == []
    assert initial_profile.json()["deny_permissions"] == []

    update_profile = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "roles": ["lagermitarbeiter"],
            "allow_permissions": ["module.permissions.read"],
            "deny_permissions": ["page.dashboard.view"],
        },
    )
    assert update_profile.status_code == 200
    payload = update_profile.json()
    assert payload["allow_permissions"] == ["module.permissions.read"]
    assert payload["deny_permissions"] == ["page.dashboard.view"]
    assert "page.dashboard.view" not in payload["effective_permissions"]
    assert "module.permissions.read" in payload["effective_permissions"]

    login = await client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert login.status_code == 200
    user_token = login.json()["access_token"]
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    assert me.status_code == 200
    assert "page.dashboard.view" not in me.json()["permissions"]
    assert "module.permissions.read" in me.json()["permissions"]

    unknown_role = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "roles": ["does-not-exist"],
            "allow_permissions": [],
            "deny_permissions": [],
        },
    )
    assert unknown_role.status_code == 422

    unknown_permission = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "roles": ["lagermitarbeiter"],
            "allow_permissions": ["module.permissions.read", "module.unknown"],
            "deny_permissions": [],
        },
    )
    assert unknown_permission.status_code == 422

    overlap = await client.put(
        f"/api/users/{user_id}/access-profile",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "roles": ["lagermitarbeiter"],
            "allow_permissions": ["module.permissions.read"],
            "deny_permissions": ["module.permissions.read"],
        },
    )
    assert overlap.status_code == 422
    assert overlap.json()["details"] is not None
