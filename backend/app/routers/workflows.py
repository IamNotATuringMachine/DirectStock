from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import Role, User
from app.models.phase3 import ApprovalAction, ApprovalRequest, ApprovalRule
from app.schemas.phase3 import (
    ApprovalRequestAction,
    ApprovalRequestCreate,
    ApprovalRequestResponse,
    ApprovalRuleCreate,
    ApprovalRuleResponse,
    ApprovalRuleUpdate,
)

router = APIRouter(prefix="/api", tags=["workflows"])

APPROVAL_RULE_READ_PERMISSION = "module.approval_rules.read"
APPROVAL_RULE_WRITE_PERMISSION = "module.approval_rules.write"
APPROVAL_READ_PERMISSION = "module.approvals.read"
APPROVAL_WRITE_PERMISSION = "module.approvals.write"


def _to_rule_response(item: ApprovalRule) -> ApprovalRuleResponse:
    return ApprovalRuleResponse(
        id=item.id,
        name=item.name,
        entity_type=item.entity_type,
        min_amount=item.min_amount,
        required_role=item.required_role,
        is_active=item.is_active,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_request_response(item: ApprovalRequest) -> ApprovalRequestResponse:
    return ApprovalRequestResponse(
        id=item.id,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        status=item.status,
        amount=item.amount,
        reason=item.reason,
        requested_by=item.requested_by,
        requested_at=item.requested_at,
        decided_by=item.decided_by,
        decided_at=item.decided_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _validate_required_role(db: AsyncSession, role_name: str) -> None:
    role = (await db.execute(select(Role).where(Role.name == role_name))).scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown role: {role_name}")


@router.get("/approval-rules", response_model=list[ApprovalRuleResponse])
async def list_approval_rules(
    entity_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(APPROVAL_RULE_READ_PERMISSION)),
) -> list[ApprovalRuleResponse]:
    stmt = select(ApprovalRule).order_by(ApprovalRule.id.asc())
    if entity_type:
        stmt = stmt.where(ApprovalRule.entity_type == entity_type)
    rows = list((await db.execute(stmt)).scalars())
    return [_to_rule_response(item) for item in rows]


@router.post("/approval-rules", response_model=ApprovalRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_rule(
    payload: ApprovalRuleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(APPROVAL_RULE_WRITE_PERMISSION)),
) -> ApprovalRuleResponse:
    await _validate_required_role(db, payload.required_role)
    item = ApprovalRule(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_rule_response(item)


@router.put("/approval-rules/{rule_id}", response_model=ApprovalRuleResponse)
async def update_approval_rule(
    rule_id: int,
    payload: ApprovalRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(APPROVAL_RULE_WRITE_PERMISSION)),
) -> ApprovalRuleResponse:
    item = (await db.execute(select(ApprovalRule).where(ApprovalRule.id == rule_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval rule not found")

    updates = payload.model_dump(exclude_unset=True)
    required_role = updates.get("required_role")
    if required_role is not None:
        await _validate_required_role(db, required_role)

    for key, value in updates.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _to_rule_response(item)


@router.delete("/approval-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approval_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(APPROVAL_RULE_WRITE_PERMISSION)),
) -> None:
    item = (await db.execute(select(ApprovalRule).where(ApprovalRule.id == rule_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval rule not found")
    await db.delete(item)
    await db.commit()


@router.get("/approvals", response_model=list[ApprovalRequestResponse])
async def list_approvals(
    status_filter: str | None = Query(default=None, alias="status"),
    entity_type: str | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(APPROVAL_READ_PERMISSION)),
) -> list[ApprovalRequestResponse]:
    stmt = select(ApprovalRequest).order_by(ApprovalRequest.id.desc())
    if status_filter:
        stmt = stmt.where(ApprovalRequest.status == status_filter)
    if entity_type:
        stmt = stmt.where(ApprovalRequest.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(ApprovalRequest.entity_id == entity_id)

    rows = list((await db.execute(stmt)).scalars())
    return [_to_request_response(item) for item in rows]


@router.post("/approvals", response_model=ApprovalRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_request(
    payload: ApprovalRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(APPROVAL_WRITE_PERMISSION)),
) -> ApprovalRequestResponse:
    request = ApprovalRequest(
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        status="pending",
        amount=payload.amount,
        reason=payload.reason,
        requested_by=current_user.id,
        requested_at=datetime.now(UTC),
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return _to_request_response(request)


async def _apply_approval_action(
    *,
    request_id: int,
    action: str,
    payload: ApprovalRequestAction,
    db: AsyncSession,
    current_user: User,
) -> ApprovalRequestResponse:
    item = (await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == request_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found")
    if item.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Approval request is already closed")

    active_rule = (
        await db.execute(
            select(ApprovalRule)
            .where(
                ApprovalRule.entity_type == item.entity_type,
                ApprovalRule.is_active.is_(True),
            )
            .order_by(ApprovalRule.id.desc())
        )
    ).scalars().first()

    if active_rule is not None:
        role_names = {role.name for role in current_user.roles}
        if active_rule.required_role not in role_names and "admin" not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required role for approval action: {active_rule.required_role}",
            )

    item.status = "approved" if action == "approve" else "rejected"
    item.decided_by = current_user.id
    item.decided_at = datetime.now(UTC)

    db.add(
        ApprovalAction(
            approval_request_id=item.id,
            action=action,
            comment=payload.comment,
            acted_by=current_user.id,
            acted_at=datetime.now(UTC),
        )
    )

    await db.commit()
    await db.refresh(item)
    return _to_request_response(item)


@router.post("/approvals/{request_id}/approve", response_model=ApprovalRequestResponse)
async def approve_request(
    request_id: int,
    payload: ApprovalRequestAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(APPROVAL_WRITE_PERMISSION)),
) -> ApprovalRequestResponse:
    return await _apply_approval_action(
        request_id=request_id,
        action="approve",
        payload=payload,
        db=db,
        current_user=current_user,
    )


@router.post("/approvals/{request_id}/reject", response_model=ApprovalRequestResponse)
async def reject_request(
    request_id: int,
    payload: ApprovalRequestAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(APPROVAL_WRITE_PERMISSION)),
) -> ApprovalRequestResponse:
    return await _apply_approval_action(
        request_id=request_id,
        action="reject",
        payload=payload,
        db=db,
        current_user=current_user,
    )
