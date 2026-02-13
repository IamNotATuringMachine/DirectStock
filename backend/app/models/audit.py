from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(16), index=True)
    endpoint: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    method: Mapped[str | None] = mapped_column(String(8), nullable=True, index=True)
    entity: Mapped[str] = mapped_column(String(64), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), index=True)
    changed_fields: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    old_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    entity_snapshot_before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    entity_snapshot_after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status_code: Mapped[int] = mapped_column(index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
