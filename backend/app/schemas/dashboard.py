from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.inventory import LowStockItem, StockMovementItem


class DashboardSummary(BaseModel):
    total_products: int
    total_warehouses: int
    total_bins: int
    total_quantity: Decimal
    low_stock_count: int
    open_goods_receipts: int
    open_goods_issues: int
    open_stock_transfers: int


class DashboardRecentMovements(BaseModel):
    items: list[StockMovementItem]


class DashboardLowStock(BaseModel):
    items: list[LowStockItem]


class DashboardActivityToday(BaseModel):
    date: date
    movements_today: int
    completed_goods_receipts_today: int
    completed_goods_issues_today: int
    completed_stock_transfers_today: int
