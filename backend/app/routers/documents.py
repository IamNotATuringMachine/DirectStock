import os
import re
from pathlib import Path
from secrets import token_hex

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.catalog import Customer, Product, Supplier
from app.models.auth import User
from app.models.inventory import GoodsIssue, GoodsReceipt, InventoryCountSession, StockTransfer
from app.models.phase3 import ApprovalRequest, ApprovalRule, Document, PickTask, PickWave, ReturnOrder
from app.models.phase4 import InterWarehouseTransfer, Shipment
from app.models.phase5 import Invoice, SalesOrder
from app.models.purchasing import PurchaseOrder
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.phase3 import DocumentListResponse, DocumentResponse

router = APIRouter(prefix="/api/documents", tags=["documents"])

READ_PERMISSION = "module.documents.read"
WRITE_PERMISSION = "module.documents.write"

ALLOWED_MIME_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
STORAGE_ROOT = Path("/app/data/documents")
_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
_ENTITY_MODEL_MAP: dict[str, type] = {
    "product": Product,
    "supplier": Supplier,
    "customer": Customer,
    "purchase_order": PurchaseOrder,
    "goods_receipt": GoodsReceipt,
    "goods_issue": GoodsIssue,
    "stock_transfer": StockTransfer,
    "inventory_count_session": InventoryCountSession,
    "pick_wave": PickWave,
    "pick_task": PickTask,
    "return_order": ReturnOrder,
    "approval": ApprovalRequest,
    "approval_rule": ApprovalRule,
    "shipment": Shipment,
    "inter_warehouse_transfer": InterWarehouseTransfer,
    "warehouse": Warehouse,
    "zone": WarehouseZone,
    "bin": BinLocation,
    "sales_order": SalesOrder,
    "invoice": Invoice,
}


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
        version=item.version,
        uploaded_by=item.uploaded_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _sanitize_filename(name: str) -> str:
    safe = Path(name).name.strip()
    safe = safe.replace(" ", "_")
    return safe or f"document-{token_hex(4)}"


def _normalize_name(value: str, *, field_name: str) -> str:
    normalized = value.strip().lower()
    if not _NAME_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}. Use lowercase letters, digits, '-' or '_' only.",
        )
    return normalized


def _resolve_storage_path(root: Path, entity_type: str, entity_id: int, document_type: str) -> Path:
    root_resolved = root.resolve()
    candidate = (root_resolved / entity_type / str(entity_id) / document_type).resolve()
    if root_resolved != candidate and root_resolved not in candidate.parents:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid storage path")
    return candidate


def _validate_stored_file_path(path: Path) -> Path:
    resolved = path.resolve()
    allowed_root = _effective_storage_root().resolve()
    if allowed_root != resolved and allowed_root not in resolved.parents:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file missing")
    return resolved


async def _validate_entity_reference(db: AsyncSession, *, entity_type: str, entity_id: int) -> None:
    if entity_id <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="entity_id must be > 0")

    model = _ENTITY_MODEL_MAP.get(entity_type)
    if model is None:
        supported = ", ".join(sorted(_ENTITY_MODEL_MAP))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported entity_type '{entity_type}'. Supported values: {supported}",
        )

    exists = (await db.execute(select(model.id).where(model.id == entity_id))).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity_type} not found")


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    entity_type: str | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    document_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(READ_PERMISSION)),
) -> DocumentListResponse:
    stmt = select(Document)
    if entity_type:
        stmt = stmt.where(Document.entity_type == _normalize_name(entity_type, field_name="entity_type"))
    if entity_id is not None:
        stmt = stmt.where(Document.entity_id == entity_id)
    if document_type:
        stmt = stmt.where(Document.document_type == _normalize_name(document_type, field_name="document_type"))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = list(
        (
            await db.execute(
                stmt.order_by(Document.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )
    return DocumentListResponse(
        items=[_to_response(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(WRITE_PERMISSION)),
) -> DocumentResponse:
    normalized_entity_type = _normalize_name(entity_type, field_name="entity_type")
    normalized_document_type = _normalize_name(document_type, field_name="document_type")
    await _validate_entity_reference(db, entity_type=normalized_entity_type, entity_id=entity_id)

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
                Document.entity_type == normalized_entity_type,
                Document.entity_id == entity_id,
                Document.document_type == normalized_document_type,
            )
        )
    ).scalar_one()
    next_version = int(max_version) + 1

    file_name = _sanitize_filename(file.filename or "document.bin")
    storage_dir = _resolve_storage_path(
        _effective_storage_root(),
        normalized_entity_type,
        entity_id,
        normalized_document_type,
    )
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"v{next_version:03d}_{token_hex(4)}_{file_name}"
    storage_path = storage_dir / storage_name
    storage_path.write_bytes(raw)

    item = Document(
        entity_type=normalized_entity_type,
        entity_id=entity_id,
        document_type=normalized_document_type,
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
    _=Depends(require_permissions(READ_PERMISSION)),
):
    item = (await db.execute(select(Document).where(Document.id == document_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    path = Path(item.storage_path)
    path = _validate_stored_file_path(path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file missing")

    return FileResponse(path, media_type=item.mime_type, filename=item.file_name)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(WRITE_PERMISSION)),
) -> None:
    item = (await db.execute(select(Document).where(Document.id == document_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    path = _validate_stored_file_path(Path(item.storage_path))
    await db.delete(item)
    await db.commit()
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
