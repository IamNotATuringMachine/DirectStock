import os
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_roles
from app.models.auth import User
from app.models.phase3 import Document
from app.schemas.phase3 import DocumentListResponse, DocumentResponse

router = APIRouter(prefix="/api/documents", tags=["documents"])

READ_ROLES = ("admin", "lagerleiter", "einkauf", "versand", "controller", "auditor")
WRITE_ROLES = ("admin", "lagerleiter", "einkauf", "versand")

ALLOWED_MIME_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
STORAGE_ROOT = Path("/app/data/documents")


def _effective_storage_root() -> Path:
    configured = Path(os.getenv("DIRECTSTOCK_DOCUMENT_STORAGE_ROOT", str(STORAGE_ROOT)))
    try:
        configured.mkdir(parents=True, exist_ok=True)
        return configured
    except OSError:
        fallback = Path.cwd() / ".documents"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _to_response(item: Document) -> DocumentResponse:
    return DocumentResponse(
        id=item.id,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        document_type=item.document_type,
        file_name=item.file_name,
        mime_type=item.mime_type,
        file_size=item.file_size,
        storage_path=item.storage_path,
        version=item.version,
        uploaded_by=item.uploaded_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _sanitize_filename(name: str) -> str:
    safe = Path(name).name.strip()
    safe = safe.replace(" ", "_")
    return safe or f"document-{token_hex(4)}"


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    entity_type: str | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    document_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
) -> DocumentListResponse:
    stmt = select(Document).order_by(Document.id.desc())
    if entity_type:
        stmt = stmt.where(Document.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(Document.entity_id == entity_id)
    if document_type:
        stmt = stmt.where(Document.document_type == document_type)

    rows = list((await db.execute(stmt)).scalars())
    return DocumentListResponse(items=[_to_response(item) for item in rows], total=len(rows))


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*WRITE_ROLES)),
) -> DocumentResponse:
    mime_type = (file.content_type or "").lower()
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported mime type: {mime_type}",
        )

    raw = await file.read()
    size = len(raw)
    if size <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty file is not allowed")
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File too large: {size} bytes (max {MAX_FILE_SIZE_BYTES})",
        )

    max_version = (
        await db.execute(
            select(func.coalesce(func.max(Document.version), 0)).where(
                Document.entity_type == entity_type,
                Document.entity_id == entity_id,
                Document.document_type == document_type,
            )
        )
    ).scalar_one()
    next_version = int(max_version) + 1

    file_name = _sanitize_filename(file.filename or "document.bin")
    storage_dir = _effective_storage_root() / entity_type / str(entity_id) / document_type
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"v{next_version:03d}_{token_hex(4)}_{file_name}"
    storage_path = storage_dir / storage_name
    storage_path.write_bytes(raw)

    item = Document(
        entity_type=entity_type,
        entity_id=entity_id,
        document_type=document_type,
        file_name=file_name,
        mime_type=mime_type,
        file_size=size,
        storage_path=str(storage_path),
        version=next_version,
        uploaded_by=current_user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_response(item)


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*READ_ROLES)),
):
    item = (await db.execute(select(Document).where(Document.id == document_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    path = Path(item.storage_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file missing")

    return FileResponse(path, media_type=item.mime_type, filename=item.file_name)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*WRITE_ROLES)),
) -> None:
    item = (await db.execute(select(Document).where(Document.id == document_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    path = Path(item.storage_path)
    await db.delete(item)
    await db.commit()
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
