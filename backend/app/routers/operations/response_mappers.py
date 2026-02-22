from decimal import Decimal

from app.models.catalog import Product
from app.models.inventory import (
    GoodsIssue,
    GoodsIssueItem,
    GoodsReceipt,
    GoodsReceiptItem,
    StockTransfer,
    StockTransferItem,
)
from app.schemas.operations import (
    GoodsIssueItemResponse,
    GoodsIssueResponse,
    GoodsReceiptItemResponse,
    GoodsReceiptResponse,
    StockTransferItemResponse,
    StockTransferResponse,
)
from app.schemas.operators import OperationSignoffSummary
from app.schemas.product import ProductResponse


def _to_product_response(item: Product) -> ProductResponse:
    return ProductResponse(
        id=item.id,
        product_number=item.product_number,
        name=item.name,
        description=item.description,
        product_group_id=item.product_group_id,
        group_name=item.group.name if item.group else None,
        unit=item.unit,
        status=item.status,
        requires_item_tracking=item.requires_item_tracking,
        default_bin_id=item.default_bin_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_receipt_response(
    item: GoodsReceipt,
    *,
    operation_signoff: OperationSignoffSummary | None = None,
) -> GoodsReceiptResponse:
    return GoodsReceiptResponse(
        id=item.id,
        receipt_number=item.receipt_number,
        supplier_id=item.supplier_id,
        purchase_order_id=item.purchase_order_id,
        mode=item.mode,
        source_type=item.source_type,
        status=item.status,
        received_at=item.received_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        operation_signoff=operation_signoff,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_receipt_item_response(
    item: GoodsReceiptItem,
    *,
    product_number: str | None = None,
    product_name: str | None = None,
    target_bin_code: str | None = None,
    expected_open_quantity: Decimal | None = None,
) -> GoodsReceiptItemResponse:
    variance_quantity = (
        Decimal(item.received_quantity) - Decimal(item.expected_quantity)
        if item.expected_quantity is not None
        else None
    )
    return GoodsReceiptItemResponse(
        id=item.id,
        goods_receipt_id=item.goods_receipt_id,
        product_id=item.product_id,
        expected_quantity=item.expected_quantity,
        received_quantity=item.received_quantity,
        unit=item.unit,
        target_bin_id=item.target_bin_id,
        batch_number=item.batch_number,
        expiry_date=item.expiry_date,
        manufactured_at=item.manufactured_at,
        serial_numbers=item.serial_numbers,
        purchase_order_item_id=item.purchase_order_item_id,
        input_method=item.input_method,
        condition=item.condition,
        product_number=product_number,
        product_name=product_name,
        target_bin_code=target_bin_code,
        expected_open_quantity=expected_open_quantity,
        variance_quantity=variance_quantity,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_issue_response(
    item: GoodsIssue,
    *,
    operation_signoff: OperationSignoffSummary | None = None,
) -> GoodsIssueResponse:
    return GoodsIssueResponse(
        id=item.id,
        issue_number=item.issue_number,
        customer_id=item.customer_id,
        customer_location_id=item.customer_location_id,
        customer_reference=item.customer_reference,
        status=item.status,
        issued_at=item.issued_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        operation_signoff=operation_signoff,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_goods_issue_item_response(item: GoodsIssueItem) -> GoodsIssueItemResponse:
    return GoodsIssueItemResponse(
        id=item.id,
        goods_issue_id=item.goods_issue_id,
        product_id=item.product_id,
        requested_quantity=item.requested_quantity,
        issued_quantity=item.issued_quantity,
        unit=item.unit,
        source_bin_id=item.source_bin_id,
        batch_number=item.batch_number,
        use_fefo=item.use_fefo,
        serial_numbers=item.serial_numbers,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_stock_transfer_response(item: StockTransfer) -> StockTransferResponse:
    return StockTransferResponse(
        id=item.id,
        transfer_number=item.transfer_number,
        status=item.status,
        transferred_at=item.transferred_at,
        completed_at=item.completed_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _to_stock_transfer_item_response(item: StockTransferItem) -> StockTransferItemResponse:
    return StockTransferItemResponse(
        id=item.id,
        stock_transfer_id=item.stock_transfer_id,
        product_id=item.product_id,
        quantity=item.quantity,
        unit=item.unit,
        from_bin_id=item.from_bin_id,
        to_bin_id=item.to_bin_id,
        batch_number=item.batch_number,
        serial_numbers=item.serial_numbers,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
