from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import Role, User
from app.models.phase5 import DashboardCard, RoleDashboardPolicy, UserDashboardConfig
from app.schemas.phase5 import (
    DashboardCardCatalogItem,
    DashboardRolePolicyResponse,
    DashboardRolePolicyUpdate,
    DashboardUserConfigItem,
    DashboardUserConfigResponse,
    DashboardUserConfigUpdate,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard-config"])


def _catalog_item(card: DashboardCard) -> DashboardCardCatalogItem:
    return DashboardCardCatalogItem(
        card_key=card.card_key,
        title=card.title,
        description=card.description,
        default_order=card.default_order,
        is_active=card.is_active,
    )


async def _load_catalog(db: AsyncSession) -> list[DashboardCard]:
    return list((await db.execute(select(DashboardCard).where(DashboardCard.is_active.is_(True)).order_by(DashboardCard.default_order.asc(), DashboardCard.card_key.asc()))).scalars())


async def _load_user_allowed_map(db: AsyncSession, user: User) -> dict[str, dict[str, bool]]:
    role_ids = [role.id for role in user.roles]
    if not role_ids:
        return {}

    rows = list(
        (
            await db.execute(
                select(RoleDashboardPolicy).where(RoleDashboardPolicy.role_id.in_(role_ids))
            )
        ).scalars()
    )

    grouped: dict[str, list[RoleDashboardPolicy]] = defaultdict(list)
    for row in rows:
        grouped[row.card_key].append(row)

    out: dict[str, dict[str, bool]] = {}
    for card_key, policies in grouped.items():
        out[card_key] = {
            "allowed": any(policy.allowed for policy in policies),
            "default_visible": any(policy.default_visible for policy in policies),
            "locked": any(policy.locked for policy in policies),
        }
    return out


@router.get("/cards/catalog", response_model=list[DashboardCardCatalogItem])
async def dashboard_cards_catalog(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.dashboard_config.read")),
) -> list[DashboardCardCatalogItem]:
    cards = await _load_catalog(db)
    return [_catalog_item(card) for card in cards]


@router.get("/config/me", response_model=DashboardUserConfigResponse)
async def get_my_dashboard_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.dashboard_config.manage_self")),
) -> DashboardUserConfigResponse:
    catalog = await _load_catalog(db)
    allowed_map = await _load_user_allowed_map(db, current_user)

    user_rows = {
        row.card_key: row
        for row in (
            await db.execute(select(UserDashboardConfig).where(UserDashboardConfig.user_id == current_user.id))
        ).scalars()
    }

    items: list[DashboardUserConfigItem] = []
    for card in catalog:
        policy = allowed_map.get(card.card_key, {"allowed": True, "default_visible": True, "locked": False})
        if not policy["allowed"]:
            continue
        configured = user_rows.get(card.card_key)
        visible = configured.visible if configured is not None else policy["default_visible"]
        display_order = configured.display_order if configured is not None else card.default_order
        items.append(
            DashboardUserConfigItem(card_key=card.card_key, visible=visible, display_order=display_order)
        )

    items.sort(key=lambda item: (item.display_order, item.card_key))
    return DashboardUserConfigResponse(cards=items)


@router.put("/config/me", response_model=DashboardUserConfigResponse)
async def update_my_dashboard_config(
    payload: DashboardUserConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.dashboard_config.manage_self")),
) -> DashboardUserConfigResponse:
    catalog = await _load_catalog(db)
    catalog_map = {row.card_key: row for row in catalog}
    allowed_map = await _load_user_allowed_map(db, current_user)

    seen: set[str] = set()
    for item in payload.cards:
        if item.card_key in seen:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Duplicate card_key: {item.card_key}")
        seen.add(item.card_key)
        if item.card_key not in catalog_map:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown card_key: {item.card_key}")
        policy = allowed_map.get(item.card_key, {"allowed": True, "default_visible": True, "locked": False})
        if not policy["allowed"]:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Card not allowed: {item.card_key}")
        if policy["locked"] and not item.visible:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Locked card cannot be hidden: {item.card_key}")

    await db.execute(delete(UserDashboardConfig).where(UserDashboardConfig.user_id == current_user.id))
    for item in payload.cards:
        db.add(
            UserDashboardConfig(
                user_id=current_user.id,
                card_key=item.card_key,
                visible=item.visible,
                display_order=item.display_order,
            )
        )
    await db.commit()
    return await get_my_dashboard_config(db=db, current_user=current_user)


@router.get("/config/roles/{role_id}", response_model=DashboardRolePolicyResponse)
async def get_role_dashboard_config(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.dashboard_config.manage_role")),
) -> DashboardRolePolicyResponse:
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    catalog = await _load_catalog(db)
    rows = {
        row.card_key: row
        for row in (
            await db.execute(select(RoleDashboardPolicy).where(RoleDashboardPolicy.role_id == role_id))
        ).scalars()
    }

    cards = []
    for card in catalog:
        row = rows.get(card.card_key)
        cards.append(
            {
                "card_key": card.card_key,
                "allowed": row.allowed if row is not None else True,
                "default_visible": row.default_visible if row is not None else True,
                "locked": row.locked if row is not None else False,
            }
        )

    cards.sort(key=lambda item: item["card_key"])
    return DashboardRolePolicyResponse(role_id=role_id, cards=cards)


@router.put("/config/roles/{role_id}", response_model=DashboardRolePolicyResponse)
async def update_role_dashboard_config(
    role_id: int,
    payload: DashboardRolePolicyUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.dashboard_config.manage_role")),
) -> DashboardRolePolicyResponse:
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    catalog = await _load_catalog(db)
    catalog_keys = {row.card_key for row in catalog}

    incoming = {item.card_key: item for item in payload.cards}
    unknown = sorted(set(incoming) - catalog_keys)
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown card_key values: {', '.join(unknown)}",
        )

    await db.execute(delete(RoleDashboardPolicy).where(RoleDashboardPolicy.role_id == role_id))

    for card in catalog:
        item = incoming.get(card.card_key)
        db.add(
            RoleDashboardPolicy(
                role_id=role_id,
                card_key=card.card_key,
                allowed=item.allowed if item else True,
                default_visible=item.default_visible if item else True,
                locked=item.locked if item else False,
            )
        )

    await db.commit()
    return await get_role_dashboard_config(role_id=role_id, db=db)
