from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.dependencies import get_db, require_permissions
from app.models.phase5 import PurchaseEmailSetting
from app.schemas.purchase_email_settings import (
    PurchaseEmailSenderProfileResponse,
    PurchaseEmailSenderProfileUpdate,
    PurchaseEmailSettingsResponse,
    PurchaseEmailSettingsUpdate,
)

router = APIRouter(prefix="/api/purchase-email-settings", tags=["purchase-email-settings"])

PURCHASE_EMAIL_SETTINGS_READ_PERMISSION = "module.suppliers.read"
PURCHASE_EMAIL_SETTINGS_WRITE_PERMISSION = "module.suppliers.write"


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _to_profile_response(row: PurchaseEmailSetting) -> PurchaseEmailSenderProfileResponse:
    return PurchaseEmailSenderProfileResponse(
        id=row.id,
        profile_name=row.profile_name,
        is_active=row.is_active,
        smtp_enabled=row.smtp_enabled,
        smtp_host=row.smtp_host,
        smtp_port=row.smtp_port,
        smtp_username=row.smtp_username,
        smtp_password_set=bool((row.smtp_password or "").strip()),
        smtp_use_tls=row.smtp_use_tls,
        from_address=row.from_address,
        reply_to_address=row.reply_to_address,
        sender_name=row.sender_name,
        imap_enabled=row.imap_enabled,
        imap_host=row.imap_host,
        imap_port=row.imap_port,
        imap_username=row.imap_username,
        imap_password_set=bool((row.imap_password or "").strip()),
        imap_mailbox=row.imap_mailbox,
        imap_use_ssl=row.imap_use_ssl,
        poll_interval_seconds=row.poll_interval_seconds,
        default_to_addresses=row.default_to_addresses,
        default_cc_addresses=row.default_cc_addresses,
    )


def _to_response(rows: list[PurchaseEmailSetting]) -> PurchaseEmailSettingsResponse:
    if not rows:
        raise RuntimeError("purchase email settings response requires at least one profile")

    active = next((row for row in rows if row.is_active), rows[0])
    return PurchaseEmailSettingsResponse(
        active_profile_id=active.id,
        profiles=[_to_profile_response(row) for row in rows],
    )


def _build_default_profile(settings: Settings) -> PurchaseEmailSetting:
    return PurchaseEmailSetting(
        profile_name="Standard",
        is_active=True,
        smtp_enabled=settings.purchase_email_smtp_enabled,
        smtp_host=settings.purchase_email_smtp_host or None,
        smtp_port=settings.purchase_email_smtp_port,
        smtp_username=settings.purchase_email_smtp_username or None,
        smtp_password=settings.purchase_email_smtp_password or None,
        smtp_use_tls=settings.purchase_email_smtp_use_tls,
        from_address=settings.purchase_email_from_address,
        reply_to_address=settings.purchase_email_reply_to_address,
        sender_name=settings.purchase_email_sender_name,
        imap_enabled=settings.purchase_email_imap_enabled,
        imap_host=settings.purchase_email_imap_host or None,
        imap_port=settings.purchase_email_imap_port,
        imap_username=settings.purchase_email_imap_username or None,
        imap_password=settings.purchase_email_imap_password or None,
        imap_mailbox=settings.purchase_email_imap_mailbox,
        imap_use_ssl=settings.purchase_email_imap_use_ssl,
        poll_interval_seconds=settings.purchase_email_poll_interval_seconds,
        default_to_addresses=settings.purchase_email_default_to_addresses or None,
        default_cc_addresses=settings.purchase_email_default_cc_addresses or None,
    )


async def _load_profiles(db: AsyncSession) -> list[PurchaseEmailSetting]:
    return list((await db.execute(select(PurchaseEmailSetting).order_by(PurchaseEmailSetting.id.asc()))).scalars())


async def _ensure_profiles(db: AsyncSession) -> list[PurchaseEmailSetting]:
    rows = await _load_profiles(db)
    changed = False
    if not rows:
        row = _build_default_profile(get_settings())
        db.add(row)
        await db.flush()
        rows = [row]
        changed = True

    active_rows = [row for row in rows if row.is_active]
    if len(active_rows) != 1:
        for idx, row in enumerate(rows):
            row.is_active = idx == 0
        changed = True

    if changed:
        await db.commit()
        rows = await _load_profiles(db)

    return rows


def _apply_profile_payload(
    row: PurchaseEmailSetting,
    payload: PurchaseEmailSenderProfileUpdate,
    *,
    defaults: Settings,
) -> None:
    row.profile_name = payload.profile_name.strip() or "Standard"
    row.smtp_enabled = payload.smtp_enabled
    row.smtp_host = _clean_optional(payload.smtp_host)
    row.smtp_port = payload.smtp_port
    row.smtp_username = _clean_optional(payload.smtp_username)
    row.smtp_use_tls = payload.smtp_use_tls
    row.from_address = payload.from_address.strip() or defaults.purchase_email_from_address
    row.reply_to_address = payload.reply_to_address.strip() or defaults.purchase_email_reply_to_address
    row.sender_name = payload.sender_name.strip() or defaults.purchase_email_sender_name
    row.imap_enabled = payload.imap_enabled
    row.imap_host = _clean_optional(payload.imap_host)
    row.imap_port = payload.imap_port
    row.imap_username = _clean_optional(payload.imap_username)
    row.imap_mailbox = payload.imap_mailbox.strip() or "INBOX"
    row.imap_use_ssl = payload.imap_use_ssl
    row.poll_interval_seconds = payload.poll_interval_seconds
    row.default_to_addresses = _clean_optional(payload.default_to_addresses)
    row.default_cc_addresses = _clean_optional(payload.default_cc_addresses)

    if payload.clear_smtp_password:
        row.smtp_password = None
    elif payload.smtp_password is not None:
        row.smtp_password = payload.smtp_password.strip() or None

    if payload.clear_imap_password:
        row.imap_password = None
    elif payload.imap_password is not None:
        row.imap_password = payload.imap_password.strip() or None


@router.get("", response_model=PurchaseEmailSettingsResponse)
async def get_purchase_email_settings(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PURCHASE_EMAIL_SETTINGS_READ_PERMISSION)),
) -> PurchaseEmailSettingsResponse:
    rows = await _ensure_profiles(db)
    return _to_response(rows)


@router.put("", response_model=PurchaseEmailSettingsResponse)
async def update_purchase_email_settings(
    payload: PurchaseEmailSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(PURCHASE_EMAIL_SETTINGS_WRITE_PERMISSION)),
) -> PurchaseEmailSettingsResponse:
    defaults = get_settings()
    existing_rows = await _ensure_profiles(db)
    existing_by_id = {row.id: row for row in existing_rows}

    persisted_rows: list[PurchaseEmailSetting] = []
    seen_payload_ids: set[int] = set()
    for profile_payload in payload.profiles:
        if profile_payload.id is None:
            row = _build_default_profile(defaults)
            db.add(row)
            await db.flush()
        else:
            if profile_payload.id in seen_payload_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Duplicate profile id in payload: {profile_payload.id}",
                )
            seen_payload_ids.add(profile_payload.id)
            row = existing_by_id.get(profile_payload.id)
            if row is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Unknown profile id: {profile_payload.id}",
                )

        _apply_profile_payload(row, profile_payload, defaults=defaults)
        persisted_rows.append(row)

    persisted_ids = {row.id for row in persisted_rows if row.id is not None}
    stale_rows = [row for row in existing_rows if row.id not in persisted_ids]
    for row in stale_rows:
        await db.delete(row)

    active_index = next((idx for idx, item in enumerate(payload.profiles) if item.is_active), 0)
    if active_index >= len(persisted_rows):
        active_index = 0

    for idx, row in enumerate(persisted_rows):
        row.is_active = idx == active_index

    await db.commit()
    rows = await _load_profiles(db)
    if not rows:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No sender profile persisted")
    return _to_response(rows)
