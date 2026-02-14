from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import Permission
from app.schemas.phase5 import PermissionResponse

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


@router.get("", response_model=list[PermissionResponse])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.permissions.read")),
) -> list[PermissionResponse]:
    rows = list((await db.execute(select(Permission).order_by(Permission.code.asc()))).scalars())
    return [PermissionResponse(code=row.code, description=row.description) for row in rows]
