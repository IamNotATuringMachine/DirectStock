import os
from pathlib import Path
import tempfile
from uuid import uuid4
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

test_db_path = Path(tempfile.gettempdir()) / f"directstock_test_{uuid4().hex}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"
os.environ["ASYNC_DATABASE_URL"] = f"sqlite+aiosqlite:///{test_db_path}"
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("DIRECTSTOCK_ADMIN_USERNAME", "admin")
os.environ.setdefault("DIRECTSTOCK_ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("DIRECTSTOCK_ADMIN_PASSWORD", "DirectStock2026!")
os.environ.setdefault("OBSERVABILITY_ENABLED", "false")
os.environ.setdefault("METRICS_ENABLED", "false")
os.environ["PURCHASE_EMAIL_SMTP_ENABLED"] = "false"
os.environ["PURCHASE_EMAIL_IMAP_ENABLED"] = "false"

from app.bootstrap import seed_defaults
from app.database import AsyncSessionLocal, engine
from app.main import app
from app.models import Base
from app.models.auth import User
from app.utils.security import create_access_token


@pytest.fixture(scope="session", autouse=True)
async def setup_database() -> AsyncGenerator[None, None]:
    database_url = os.environ.get("DATABASE_URL", "")
    async_database_url = os.environ.get("ASYNC_DATABASE_URL", "")
    if not database_url.startswith("sqlite:///") or not async_database_url.startswith(
        "sqlite+aiosqlite:///"
    ):
        raise RuntimeError(
            "Unsafe test database configuration detected. "
            "Expected SQLite URLs for DATABASE_URL and ASYNC_DATABASE_URL."
        )

    if test_db_path.exists():
        test_db_path.unlink()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await seed_defaults(session)

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    if test_db_path.exists():
        test_db_path.unlink()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture
async def client(setup_database) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


@pytest.fixture
async def admin_token(db_session: AsyncSession) -> str:
    result = await db_session.execute(
        select(User).where(User.username == "admin").options(selectinload(User.roles))
    )
    user = result.scalar_one()
    return create_access_token(
        user_id=user.id,
        username=user.username,
        roles=[role.name for role in user.roles],
        token_version=user.token_version,
    )
