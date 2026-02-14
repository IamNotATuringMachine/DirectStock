from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.phase5 import AppPage
from app.schemas.phase5 import PageResponse

router = APIRouter(prefix="/api/pages", tags=["pages"])


@router.get("", response_model=list[PageResponse])
async def list_pages(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.pages.read")),
) -> list[PageResponse]:
    rows = list((await db.execute(select(AppPage).order_by(AppPage.slug.asc()))).scalars())
    return [
        PageResponse(
            id=row.id,
            slug=row.slug,
            title=row.title,
            description=row.description,
        )
        for row in rows
    ]
