from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.auth import Role, User
from app.utils.security import hash_password

DEFAULT_ROLES: list[tuple[str, str]] = [
    ("admin", "Administrator"),
    ("lagerleiter", "Lagerleiter"),
    ("lagermitarbeiter", "Lagermitarbeiter"),
    ("einkauf", "Einkauf"),
    ("versand", "Versand"),
    ("controller", "Controlling"),
    ("auditor", "Audit / Read-Only"),
    ("tablet_ops", "Tablet Operations"),
]

DEFAULT_USERS = [
    {
        "username": "lagerleiter",
        "email": "lagerleiter@directstock.local",
        "full_name": "DirectStock Lagerleitung",
        "password": "Lagerleiter2026!",
        "roles": ["lagerleiter"],
    },
    {
        "username": "lagermitarbeiter",
        "email": "lagermitarbeiter@directstock.local",
        "full_name": "DirectStock Lagerteam",
        "password": "Lagermitarbeiter2026!",
        "roles": ["lagermitarbeiter"],
    },
]


async def _seed_roles(db: AsyncSession) -> dict[str, Role]:
    existing_roles = {
        role.name: role for role in (await db.execute(select(Role).options(selectinload(Role.permissions)))).scalars()
    }

    for role_name, description in DEFAULT_ROLES:
        role = existing_roles.get(role_name)
        if role is None:
            role = Role(name=role_name, description=description)
            db.add(role)
            existing_roles[role_name] = role
        else:
            role.description = description

    await db.flush()
    return existing_roles


async def _seed_users(db: AsyncSession, role_map: dict[str, Role]) -> User:
    settings = get_settings()

    desired_users = [
        {
            "username": settings.default_admin_username,
            "email": settings.default_admin_email,
            "full_name": "DirectStock Administrator",
            "password": settings.default_admin_password,
            "roles": ["admin"],
        },
        *DEFAULT_USERS,
    ]

    usernames = [user["username"] for user in desired_users]
    existing_users = {
        user.username: user
        for user in (
            await db.execute(select(User).where(User.username.in_(usernames)).options(selectinload(User.roles)))
        ).scalars()
    }

    admin_user: User | None = None

    for desired in desired_users:
        user = existing_users.get(desired["username"])
        if user is None:
            user = User(
                username=desired["username"],
                email=desired["email"],
                full_name=desired["full_name"],
                hashed_password=hash_password(desired["password"]),
                is_active=True,
            )
            db.add(user)
            existing_users[desired["username"]] = user

        user.email = desired["email"]
        user.full_name = desired["full_name"]
        user.is_active = True

        # Keep seeded credentials deterministic for local onboarding.
        user.hashed_password = hash_password(desired["password"])
        user.roles = [role_map[role_name] for role_name in desired["roles"]]

        if "admin" in desired["roles"]:
            admin_user = user

    await db.flush()

    if admin_user is None:
        raise RuntimeError("Admin user could not be seeded")
    return admin_user
