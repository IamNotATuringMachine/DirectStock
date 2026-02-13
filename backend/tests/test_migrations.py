from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_alembic_upgrade_creates_schema(tmp_path, monkeypatch):
    db_path = tmp_path / "migration_test.db"
    db_url = f"sqlite:///{db_path}"

    monkeypatch.setenv("DATABASE_URL", db_url)

    alembic_cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    command.upgrade(alembic_cfg, "head")

    engine = create_engine(db_url)
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    expected_tables = {
        "users",
        "roles",
        "products",
        "customers",
        "warehouses",
        "bin_locations",
        "inventory",
        "inventory_batches",
        "inventory_count_sessions",
        "inventory_count_items",
        "stock_movements",
        "serial_numbers",
        "goods_receipts",
        "goods_issues",
        "stock_transfers",
        "purchase_orders",
        "purchase_order_items",
        "client_operation_log",
        "audit_log",
    }

    assert expected_tables.issubset(table_names)
