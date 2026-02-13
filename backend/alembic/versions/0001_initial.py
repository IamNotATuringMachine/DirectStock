"""initial directstock schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
    )
    op.create_index("ix_permissions_code", "permissions", ["code"])

    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("name", name="uq_roles_name"),
    )
    op.create_index("ix_roles_name", "roles", ["name"])

    op.create_table(
        "product_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["parent_id"], ["product_groups.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("name", name="uq_product_groups_name"),
    )
    op.create_index("ix_product_groups_name", "product_groups", ["name"])

    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("supplier_number", sa.String(length=64), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("supplier_number", name="uq_suppliers_supplier_number"),
    )
    op.create_index("ix_suppliers_supplier_number", "suppliers", ["supplier_number"])
    op.create_index("ix_suppliers_company_name", "suppliers", ["company_name"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "warehouses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("code", name="uq_warehouses_code"),
    )
    op.create_index("ix_warehouses_code", "warehouses", ["code"])

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_number", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("product_group_id", sa.Integer(), nullable=True),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("status in ('active','blocked','deprecated','archived')", name="product_status"),
        sa.ForeignKeyConstraint(["product_group_id"], ["product_groups.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("product_number", name="uq_products_product_number"),
    )
    op.create_index("ix_products_product_number", "products", ["product_number"])
    op.create_index("ix_products_name", "products", ["name"])

    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_id", name="pk_role_permissions"),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id", name="pk_user_roles"),
    )

    op.create_table(
        "warehouse_zones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("warehouse_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("zone_type", sa.String(length=32), nullable=False, server_default="storage"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint(
            "zone_type in ('inbound','storage','picking','outbound','returns','blocked','quality')",
            name="zone_type_valid",
        ),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("warehouse_id", "code", name="uq_warehouse_zone_code"),
    )
    op.create_index("ix_warehouse_zones_warehouse_id", "warehouse_zones", ["warehouse_id"])
    op.create_index("ix_warehouse_zones_code", "warehouse_zones", ["code"])

    op.create_table(
        "product_suppliers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("supplier_product_number", sa.String(length=100), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("lead_time_days", sa.Integer(), nullable=True),
        sa.Column("min_order_quantity", sa.Numeric(12, 2), nullable=True),
        sa.Column("is_preferred", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("product_id", "supplier_id", name="uq_product_supplier"),
    )
    op.create_index("ix_product_suppliers_product_id", "product_suppliers", ["product_id"])
    op.create_index("ix_product_suppliers_supplier_id", "product_suppliers", ["supplier_id"])

    op.create_table(
        "bin_locations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("zone_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("bin_type", sa.String(length=32), nullable=False, server_default="storage"),
        sa.Column("max_weight", sa.Numeric(14, 3), nullable=True),
        sa.Column("max_volume", sa.Numeric(14, 3), nullable=True),
        sa.Column("qr_code_data", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint(
            "bin_type in ('inbound','storage','picking','outbound','returns','blocked','quality')",
            name="bin_type_valid",
        ),
        sa.ForeignKeyConstraint(["zone_id"], ["warehouse_zones.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("zone_id", "code", name="uq_zone_bin_code"),
        sa.UniqueConstraint("qr_code_data", name="uq_bin_locations_qr_code_data"),
    )
    op.create_index("ix_bin_locations_zone_id", "bin_locations", ["zone_id"])
    op.create_index("ix_bin_locations_code", "bin_locations", ["code"])

    op.create_table(
        "product_warehouse_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), nullable=False),
        sa.Column("ean", sa.String(length=32), nullable=True),
        sa.Column("gtin", sa.String(length=32), nullable=True),
        sa.Column("net_weight", sa.Numeric(12, 3), nullable=True),
        sa.Column("gross_weight", sa.Numeric(12, 3), nullable=True),
        sa.Column("length_cm", sa.Numeric(10, 2), nullable=True),
        sa.Column("width_cm", sa.Numeric(10, 2), nullable=True),
        sa.Column("height_cm", sa.Numeric(10, 2), nullable=True),
        sa.Column("min_stock", sa.Numeric(14, 3), nullable=True),
        sa.Column("reorder_point", sa.Numeric(14, 3), nullable=True),
        sa.Column("max_stock", sa.Numeric(14, 3), nullable=True),
        sa.Column("safety_stock", sa.Numeric(14, 3), nullable=True),
        sa.Column("lead_time_days", sa.Integer(), nullable=True),
        sa.Column("qr_code_data", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("product_id", "warehouse_id", name="uq_product_warehouse"),
        sa.UniqueConstraint("qr_code_data", name="uq_product_warehouse_settings_qr_code_data"),
    )
    op.create_index("ix_product_warehouse_settings_product_id", "product_warehouse_settings", ["product_id"])
    op.create_index(
        "ix_product_warehouse_settings_warehouse_id", "product_warehouse_settings", ["warehouse_id"]
    )
    op.create_index("ix_product_warehouse_settings_ean", "product_warehouse_settings", ["ean"])
    op.create_index("ix_product_warehouse_settings_gtin", "product_warehouse_settings", ["gtin"])

    op.create_table(
        "goods_issues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("issue_number", sa.String(length=64), nullable=False),
        sa.Column("customer_reference", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("issue_number", name="uq_goods_issues_issue_number"),
    )
    op.create_index("ix_goods_issues_issue_number", "goods_issues", ["issue_number"])
    op.create_index("ix_goods_issues_customer_reference", "goods_issues", ["customer_reference"])
    op.create_index("ix_goods_issues_status", "goods_issues", ["status"])

    op.create_table(
        "goods_receipts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("receipt_number", sa.String(length=64), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("receipt_number", name="uq_goods_receipts_receipt_number"),
    )
    op.create_index("ix_goods_receipts_receipt_number", "goods_receipts", ["receipt_number"])
    op.create_index("ix_goods_receipts_supplier_id", "goods_receipts", ["supplier_id"])
    op.create_index("ix_goods_receipts_status", "goods_receipts", ["status"])

    op.create_table(
        "inventory",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("bin_location_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("reserved_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["bin_location_id"], ["bin_locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("product_id", "bin_location_id", name="uq_inventory_product_bin"),
    )
    op.create_index("ix_inventory_product_id", "inventory", ["product_id"])
    op.create_index("ix_inventory_bin_location_id", "inventory", ["bin_location_id"])

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("movement_type", sa.String(length=32), nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_number", sa.String(length=100), nullable=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("from_bin_id", sa.Integer(), nullable=True),
        sa.Column("to_bin_id", sa.Integer(), nullable=True),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("performed_by", sa.Integer(), nullable=True),
        sa.Column("performed_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["from_bin_id"], ["bin_locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["performed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["to_bin_id"], ["bin_locations.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_stock_movements_product_id", "stock_movements", ["product_id"])
    op.create_index("ix_stock_movements_from_bin_id", "stock_movements", ["from_bin_id"])
    op.create_index("ix_stock_movements_to_bin_id", "stock_movements", ["to_bin_id"])
    op.create_index("ix_stock_movements_performed_at", "stock_movements", ["performed_at"])
    op.create_index("ix_stock_movements_movement_type", "stock_movements", ["movement_type"])

    op.create_table(
        "stock_transfers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transfer_number", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("transferred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("transfer_number", name="uq_stock_transfers_transfer_number"),
    )
    op.create_index("ix_stock_transfers_transfer_number", "stock_transfers", ["transfer_number"])
    op.create_index("ix_stock_transfers_status", "stock_transfers", ["status"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("request_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("entity", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("old_values", sa.JSON(), nullable=True),
        sa.Column("new_values", sa.JSON(), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_audit_log_request_id", "audit_log", ["request_id"])
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_entity", "audit_log", ["entity"])
    op.create_index("ix_audit_log_entity_id", "audit_log", ["entity_id"])
    op.create_index("ix_audit_log_status_code", "audit_log", ["status_code"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])

    op.create_table(
        "goods_issue_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("goods_issue_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("requested_quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("issued_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("source_bin_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["goods_issue_id"], ["goods_issues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_bin_id"], ["bin_locations.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_goods_issue_items_goods_issue_id", "goods_issue_items", ["goods_issue_id"])
    op.create_index("ix_goods_issue_items_product_id", "goods_issue_items", ["product_id"])
    op.create_index("ix_goods_issue_items_source_bin_id", "goods_issue_items", ["source_bin_id"])

    op.create_table(
        "goods_receipt_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("goods_receipt_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("expected_quantity", sa.Numeric(14, 3), nullable=True),
        sa.Column("received_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("target_bin_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["goods_receipt_id"], ["goods_receipts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["target_bin_id"], ["bin_locations.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_goods_receipt_items_goods_receipt_id", "goods_receipt_items", ["goods_receipt_id"])
    op.create_index("ix_goods_receipt_items_product_id", "goods_receipt_items", ["product_id"])
    op.create_index("ix_goods_receipt_items_target_bin_id", "goods_receipt_items", ["target_bin_id"])

    op.create_table(
        "stock_transfer_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_transfer_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("from_bin_id", sa.Integer(), nullable=False),
        sa.Column("to_bin_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["from_bin_id"], ["bin_locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["stock_transfer_id"], ["stock_transfers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_bin_id"], ["bin_locations.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_stock_transfer_items_stock_transfer_id", "stock_transfer_items", ["stock_transfer_id"])
    op.create_index("ix_stock_transfer_items_product_id", "stock_transfer_items", ["product_id"])
    op.create_index("ix_stock_transfer_items_from_bin_id", "stock_transfer_items", ["from_bin_id"])
    op.create_index("ix_stock_transfer_items_to_bin_id", "stock_transfer_items", ["to_bin_id"])


def downgrade() -> None:
    op.drop_table("stock_transfer_items")
    op.drop_table("goods_receipt_items")
    op.drop_table("goods_issue_items")
    op.drop_table("audit_log")
    op.drop_table("stock_transfers")
    op.drop_table("stock_movements")
    op.drop_table("inventory")
    op.drop_table("goods_receipts")
    op.drop_table("goods_issues")
    op.drop_table("product_warehouse_settings")
    op.drop_table("bin_locations")
    op.drop_table("product_suppliers")
    op.drop_table("warehouse_zones")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_table("products")
    op.drop_table("warehouses")
    op.drop_table("users")
    op.drop_table("suppliers")
    op.drop_table("product_groups")
    op.drop_table("roles")
    op.drop_table("permissions")
