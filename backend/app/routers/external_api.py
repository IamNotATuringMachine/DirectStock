from datetime import UTC, datetime
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    IntegrationAuthContext,
    get_db,
    get_integration_auth_context,
    require_integration_scopes,
)
from app.models.catalog import Product
from app.models.inventory import GoodsIssue, GoodsIssueItem, Inventory, StockMovement
from app.models.phase4 import IntegrationAccessLog, IntegrationClient, Shipment
from app.models.purchasing import PurchaseOrder, PurchaseOrderItem
from app.models.warehouse import BinLocation, Warehouse, WarehouseZone
from app.schemas.phase4 import (
    ExternalCommandGoodsIssueCreate,
    ExternalCommandGoodsIssueResponse,
    ExternalCommandPurchaseOrderCreate,
    ExternalCommandPurchaseOrderResponse,
    ExternalInventoryResponse,
    ExternalMovementResponse,
    ExternalProductResponse,
    ExternalTokenRequest,
    ExternalTokenResponse,
    ExternalWarehouseResponse,
    ShipmentResponse,
)
from app.utils.security import create_integration_access_token, verify_password

router = APIRouter(prefix="/api/external", tags=["external-api"])


def _now() -> datetime:
    return datetime.now(UTC)


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S')}-{token_hex(2).upper()}"


async def _log_access(
    db: AsyncSession,
    *,
    request: Request,
    client: IntegrationClient | None,
    scope: str | None,
    status_code: int,
    error_message: str | None,
) -> None:
    db.add(
        IntegrationAccessLog(
            integration_client_id=client.id if client else None,
            endpoint=request.url.path,
            method=request.method,
            scope=scope,
            status_code=status_code,
            request_id=getattr(request.state, "request_id", None),
            ip_address=request.client.host if request.client else None,
            error_message=error_message,
        )
    )
    await db.commit()


@router.post("/token", response_model=ExternalTokenResponse)
async def external_token(
    payload: ExternalTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ExternalTokenResponse:
    client = (
        await db.execute(select(IntegrationClient).where(IntegrationClient.client_id == payload.client_id))
    ).scalar_one_or_none()
    if client is None or not client.is_active:
        await _log_access(
            db,
            request=request,
            client=None,
            scope=payload.scope,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_message="client_not_found_or_inactive",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid client credentials")

    if not verify_password(payload.client_secret, client.secret_hash):
        await _log_access(
            db,
            request=request,
            client=client,
            scope=payload.scope,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_message="invalid_secret",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid client credentials")

    allowed_scopes = {str(scope) for scope in (client.scopes_json or [])}
    requested = {item for item in (payload.scope or "").split(" ") if item}
    effective = requested if requested else allowed_scopes
    if not effective.issubset(allowed_scopes):
        await _log_access(
            db,
            request=request,
            client=client,
            scope=payload.scope,
            status_code=status.HTTP_403_FORBIDDEN,
            error_message="invalid_scope",
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid scope requested")

    token_scopes = sorted(effective)
    token = create_integration_access_token(
        client_id=client.client_id,
        scopes=token_scopes,
        expires_minutes=client.token_ttl_minutes,
    )
    await _log_access(
        db,
        request=request,
        client=client,
        scope=" ".join(token_scopes),
        status_code=status.HTTP_200_OK,
        error_message=None,
    )
    return ExternalTokenResponse(
        access_token=token,
        expires_in=client.token_ttl_minutes * 60,
        scope=" ".join(token_scopes),
    )


@router.get("/v1/products", response_model=list[ExternalProductResponse])
async def external_products(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    context: IntegrationAuthContext = Depends(require_integration_scopes("products:read")),
) -> list[ExternalProductResponse]:
    rows = list(
        (
            await db.execute(
                select(Product)
                .order_by(Product.id.asc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )
    await _log_access(db, request=request, client=context.client, scope="products:read", status_code=200, error_message=None)
    return [
        ExternalProductResponse(
            id=row.id,
            product_number=row.product_number,
            name=row.name,
            unit=row.unit,
            status=row.status,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


@router.get("/v1/warehouses", response_model=list[ExternalWarehouseResponse])
async def external_warehouses(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    context: IntegrationAuthContext = Depends(require_integration_scopes("warehouses:read")),
) -> list[ExternalWarehouseResponse]:
    rows = list(
        (
            await db.execute(
                select(Warehouse)
                .order_by(Warehouse.id.asc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )
    await _log_access(db, request=request, client=context.client, scope="warehouses:read", status_code=200, error_message=None)
    return [
        ExternalWarehouseResponse(
            id=row.id,
            code=row.code,
            name=row.name,
            is_active=row.is_active,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


@router.get("/v1/inventory", response_model=list[ExternalInventoryResponse])
async def external_inventory(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    context: IntegrationAuthContext = Depends(require_integration_scopes("inventory:read")),
) -> list[ExternalInventoryResponse]:
    rows = (
        await db.execute(
            select(
                Inventory.product_id,
                Product.product_number,
                Product.name.label("product_name"),
                Warehouse.id.label("warehouse_id"),
                Warehouse.code.label("warehouse_code"),
                func.sum(Inventory.quantity).label("quantity"),
                func.sum(Inventory.reserved_quantity).label("reserved_quantity"),
                func.min(Inventory.unit).label("unit"),
            )
            .join(Product, Product.id == Inventory.product_id)
            .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
            .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
            .join(Warehouse, Warehouse.id == WarehouseZone.warehouse_id)
            .group_by(Inventory.product_id, Product.product_number, Product.name, Warehouse.id, Warehouse.code)
            .order_by(Inventory.product_id.asc(), Warehouse.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    await _log_access(db, request=request, client=context.client, scope="inventory:read", status_code=200, error_message=None)
    return [
        ExternalInventoryResponse(
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            warehouse_id=row.warehouse_id,
            warehouse_code=row.warehouse_code,
            quantity=row.quantity,
            reserved_quantity=row.reserved_quantity,
            available_quantity=row.quantity - row.reserved_quantity,
            unit=row.unit,
        )
        for row in rows
    ]


@router.get("/v1/movements", response_model=list[ExternalMovementResponse])
async def external_movements(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    context: IntegrationAuthContext = Depends(require_integration_scopes("movements:read")),
) -> list[ExternalMovementResponse]:
    rows = list(
        (
            await db.execute(
                select(StockMovement)
                .order_by(StockMovement.performed_at.desc(), StockMovement.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )
    await _log_access(db, request=request, client=context.client, scope="movements:read", status_code=200, error_message=None)
    return [
        ExternalMovementResponse(
            id=row.id,
            movement_type=row.movement_type,
            reference_type=row.reference_type,
            reference_number=row.reference_number,
            product_id=row.product_id,
            quantity=row.quantity,
            from_bin_id=row.from_bin_id,
            to_bin_id=row.to_bin_id,
            performed_at=row.performed_at,
        )
        for row in rows
    ]


@router.get("/v1/shipments", response_model=list[ShipmentResponse])
async def external_shipments(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    context: IntegrationAuthContext = Depends(require_integration_scopes("shipments:read")),
) -> list[ShipmentResponse]:
    rows = list(
        (
            await db.execute(
                select(Shipment)
                .order_by(Shipment.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )
    await _log_access(db, request=request, client=context.client, scope="shipments:read", status_code=200, error_message=None)
    return [
        ShipmentResponse(
            id=row.id,
            shipment_number=row.shipment_number,
            carrier=row.carrier,
            status=row.status,
            goods_issue_id=row.goods_issue_id,
            tracking_number=row.tracking_number,
            recipient_name=row.recipient_name,
            shipping_address=row.shipping_address,
            label_document_id=row.label_document_id,
            created_by=row.created_by,
            shipped_at=row.shipped_at,
            cancelled_at=row.cancelled_at,
            metadata_json=row.metadata_json,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


@router.post("/v1/commands/purchase-orders", response_model=ExternalCommandPurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def external_create_purchase_order(
    payload: ExternalCommandPurchaseOrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: IntegrationAuthContext = Depends(require_integration_scopes("orders:write")),
) -> ExternalCommandPurchaseOrderResponse:
    order = PurchaseOrder(
        order_number=payload.order_number or _generate_number("EPO"),
        supplier_id=payload.supplier_id,
        expected_delivery_at=payload.expected_delivery_at,
        notes=payload.notes,
        status="draft",
        created_by=None,
    )
    db.add(order)
    await db.flush()

    for item in payload.items:
        db.add(
            PurchaseOrderItem(
                purchase_order_id=order.id,
                product_id=item.product_id,
                ordered_quantity=item.ordered_quantity,
                unit=item.unit,
                unit_price=item.unit_price,
            )
        )

    await db.commit()
    await _log_access(db, request=request, client=context.client, scope="orders:write", status_code=201, error_message=None)
    return ExternalCommandPurchaseOrderResponse(
        purchase_order_id=order.id,
        order_number=order.order_number,
        status=order.status,
    )


@router.post("/v1/commands/goods-issues", response_model=ExternalCommandGoodsIssueResponse, status_code=status.HTTP_201_CREATED)
async def external_create_goods_issue(
    payload: ExternalCommandGoodsIssueCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    context: IntegrationAuthContext = Depends(require_integration_scopes("orders:write")),
) -> ExternalCommandGoodsIssueResponse:
    issue = GoodsIssue(
        issue_number=payload.issue_number or _generate_number("EGI"),
        customer_id=payload.customer_id,
        customer_reference=payload.customer_reference,
        notes=payload.notes,
        status="draft",
        created_by=None,
    )
    db.add(issue)
    await db.flush()

    for item in payload.items:
        db.add(
            GoodsIssueItem(
                goods_issue_id=issue.id,
                product_id=item.product_id,
                requested_quantity=item.requested_quantity,
                issued_quantity=item.requested_quantity,
                unit=item.unit,
                source_bin_id=item.source_bin_id,
                batch_number=item.batch_number,
                use_fefo=item.use_fefo,
                serial_numbers=item.serial_numbers,
            )
        )

    await db.commit()
    await _log_access(db, request=request, client=context.client, scope="orders:write", status_code=201, error_message=None)
    return ExternalCommandGoodsIssueResponse(goods_issue_id=issue.id, issue_number=issue.issue_number, status=issue.status)


@router.get("/v1/me")
async def external_me(context: IntegrationAuthContext = Depends(get_integration_auth_context)) -> dict:
    return {
        "client_id": context.client.client_id,
        "name": context.client.name,
        "scopes": sorted(context.scopes),
    }
