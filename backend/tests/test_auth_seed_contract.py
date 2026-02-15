from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.services.auth_service import authenticate_user


def _alembic_upgrade(db_url: str) -> None:
    backend_root = Path(__file__).resolve().parents[1]
    alembic_cfg = Config(str(backend_root / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_root / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    command.upgrade(alembic_cfg, "head")


def _run_auth_seed(script_path: Path, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(script_path), "--mode", "auth", "--quiet"],
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )


@pytest.mark.asyncio
async def test_seed_auth_mode_is_idempotent_and_excludes_mvp_data(tmp_path: Path, monkeypatch):
    db_path = tmp_path / "seed_auth_contract.db"
    db_url = f"sqlite:///{db_path}"
    async_db_url = f"sqlite+aiosqlite:///{db_path}"

    monkeypatch.setenv("DATABASE_URL", db_url)
    _alembic_upgrade(db_url)

    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "seed_data.py"

    env = os.environ.copy()
    env.update(
        {
            "DATABASE_URL": db_url,
            "ASYNC_DATABASE_URL": async_db_url,
            "DIRECTSTOCK_ADMIN_USERNAME": "admin",
            "DIRECTSTOCK_ADMIN_EMAIL": "admin@example.com",
            "DIRECTSTOCK_ADMIN_PASSWORD": "DirectStock2026!",
            "PYTHONPATH": str(project_root / "backend"),
        }
    )

    first = _run_auth_seed(script_path, env)
    assert first.returncode == 0, first.stderr or first.stdout

    second = _run_auth_seed(script_path, env)
    assert second.returncode == 0, second.stderr or second.stdout

    connection = sqlite3.connect(db_path)
    try:
        users = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        roles = connection.execute("SELECT COUNT(*) FROM roles").fetchone()[0]
        products = connection.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        warehouses = connection.execute("SELECT COUNT(*) FROM warehouses").fetchone()[0]
        inventory = connection.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]
        stock_movements = connection.execute("SELECT COUNT(*) FROM stock_movements").fetchone()[0]

        usernames = connection.execute("SELECT username FROM users ORDER BY username").fetchall()
        distinct_usernames = connection.execute("SELECT COUNT(DISTINCT username) FROM users").fetchone()[0]
    finally:
        connection.close()

    assert roles >= 1
    assert users >= 1
    assert products == 0
    assert warehouses == 0
    assert inventory == 0
    assert stock_movements == 0
    assert distinct_usernames == len(usernames)
    assert any(row[0] == "admin" for row in usernames)

    engine = create_async_engine(async_db_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            admin_user = await authenticate_user(session, "admin", "DirectStock2026!")
            assert admin_user is not None
            assert admin_user.username == "admin"
    finally:
        await engine.dispose()
