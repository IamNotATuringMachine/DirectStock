import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.audit import AuditLog


@pytest.mark.asyncio
async def test_audit_entry_created_for_mutation(client: AsyncClient, admin_token: str):
    response = await client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "audit_user",
            "email": "audit@example.com",
            "full_name": "Audit User",
            "password": "AuditPass123!",
            "roles": ["lagermitarbeiter"],
            "is_active": True,
        },
    )
    assert response.status_code == 201
    assert response.headers.get("X-Request-ID")

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AuditLog).where(AuditLog.entity == "users", AuditLog.action == "POST")
        )
        entry = result.scalars().first()
        assert entry is not None
        assert entry.new_values is not None
