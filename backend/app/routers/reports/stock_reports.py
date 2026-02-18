# ruff: noqa: F403, F405
from .common import *  # noqa: F403, F405


@router.get("/stock", response_model=ReportStockResponse)
async def report_stock(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    search: str | None = Query(default=None),
    warehouse_id: int | None = Query(default=None),
    output: ExportFormat = Query(default="json", alias="format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(REPORTS_READ_PERMISSION)),
) -> ReportStockResponse | Response:
    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(Product.product_number.ilike(term), Product.name.ilike(term)))
    if warehouse_id is not None:
        filters.append(WarehouseZone.warehouse_id == warehouse_id)

    stmt = (
        select(
            Product.id.label("product_id"),
            Product.product_number.label("product_number"),
            Product.name.label("product_name"),
            func.sum(Inventory.quantity).label("total_quantity"),
            func.sum(Inventory.reserved_quantity).label("reserved_quantity"),
            func.min(Inventory.unit).label("unit"),
        )
        .join(Inventory, Inventory.product_id == Product.id)
        .join(BinLocation, BinLocation.id == Inventory.bin_location_id)
        .join(WarehouseZone, WarehouseZone.id == BinLocation.zone_id)
    )
    if filters:
        stmt = stmt.where(*filters)
    stmt = stmt.group_by(Product.id, Product.product_number, Product.name)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(stmt.order_by(Product.product_number.asc()).offset((page - 1) * page_size).limit(page_size))
    ).all()

    items = [
        ReportStockRow(
            product_id=row.product_id,
            product_number=row.product_number,
            product_name=row.product_name,
            total_quantity=row.total_quantity,
            reserved_quantity=row.reserved_quantity,
            available_quantity=row.total_quantity - row.reserved_quantity,
            unit=row.unit,
        )
        for row in rows
    ]

    if output != "json":
        return _tabular_response(
            output_format=output,
            fieldnames=[
                "product_id",
                "product_number",
                "product_name",
                "total_quantity",
                "reserved_quantity",
                "available_quantity",
                "unit",
            ],
            rows=[item.model_dump() for item in items],
            basename="reports-stock",
        )

    return ReportStockResponse(items=items, total=total, page=page, page_size=page_size)
