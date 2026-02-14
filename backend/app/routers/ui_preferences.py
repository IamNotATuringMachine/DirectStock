from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.phase5 import UserUiPreference
from app.schemas.phase5 import ThemePreferenceResponse, ThemePreferenceUpdate

router = APIRouter(prefix="/api/ui-preferences", tags=["ui-preferences"])


async def _get_or_create_preferences(db: AsyncSession, user_id: int) -> UserUiPreference:
    row = (await db.execute(select(UserUiPreference).where(UserUiPreference.user_id == user_id))).scalar_one_or_none()
    if row is None:
        row = UserUiPreference(user_id=user_id, theme="system", compact_mode=False, show_help=True)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("/me", response_model=ThemePreferenceResponse)
async def get_my_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.ui_preferences.manage_self")),
) -> ThemePreferenceResponse:
    row = await _get_or_create_preferences(db, current_user.id)
    return ThemePreferenceResponse(theme=row.theme, compact_mode=row.compact_mode, show_help=row.show_help)


@router.put("/me", response_model=ThemePreferenceResponse)
async def update_my_preferences(
    payload: ThemePreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions("module.ui_preferences.manage_self")),
) -> ThemePreferenceResponse:
    row = await _get_or_create_preferences(db, current_user.id)
    row.theme = payload.theme
    row.compact_mode = payload.compact_mode
    row.show_help = payload.show_help
    await db.commit()
    await db.refresh(row)
    return ThemePreferenceResponse(theme=row.theme, compact_mode=row.compact_mode, show_help=row.show_help)
