from .common import *


@router.get("/goods-receipts/{receipt_id}/items/{item_id}/serial-labels/pdf")
async def get_goods_receipt_item_serial_labels_pdf(
    receipt_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> Response:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    receipt_item = (
        await db.execute(
            select(GoodsReceiptItem).where(
                GoodsReceiptItem.id == item_id,
                GoodsReceiptItem.goods_receipt_id == receipt_id,
            )
        )
    ).scalar_one_or_none()
    if receipt_item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt item not found")

    serial_numbers = _normalize_serial_numbers(receipt_item.serial_numbers)
    if not serial_numbers:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Goods receipt item has no serial numbers",
        )

    product = (await db.execute(select(Product).where(Product.id == receipt_item.product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    labels = [
        (
            product.name,
            serial_number,
            product.product_number,
            f"DS:SN:{serial_number}",
        )
        for serial_number in serial_numbers
    ]
    pdf_bytes = generate_serial_labels_pdf(labels)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="we-{receipt_id}-item-{item_id}-serial-labels.pdf"'},
    )


@router.get("/goods-receipts/{receipt_id}/items/{item_id}/item-labels/pdf")
async def get_goods_receipt_item_labels_pdf(
    receipt_id: int,
    item_id: int,
    copies: int = Query(default=1, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(GOODS_RECEIPT_READ_PERMISSION)),
) -> Response:
    parent = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == receipt_id))).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found")

    receipt_item = (
        await db.execute(
            select(GoodsReceiptItem).where(
                GoodsReceiptItem.id == item_id,
                GoodsReceiptItem.goods_receipt_id == receipt_id,
            )
        )
    ).scalar_one_or_none()
    if receipt_item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt item not found")

    product = (await db.execute(select(Product).where(Product.id == receipt_item.product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    labels: list[tuple[str, str, str]] = []
    for index in range(1, copies + 1):
        qr_payload = f"DS:ART:{product.product_number}"
        labels.append((product.name, product.product_number, f"{qr_payload}:C{index:03d}"))

    pdf_bytes = generate_item_labels_pdf(labels)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="we-{receipt_id}-item-{item_id}-labels.pdf"'},
    )
