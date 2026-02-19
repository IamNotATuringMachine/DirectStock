#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import psycopg
from mcp.server.fastmcp import FastMCP
from psycopg.rows import dict_row

WRITE_VERBS = {
    "ALTER",
    "COPY",
    "CREATE",
    "DELETE",
    "DROP",
    "GRANT",
    "INSERT",
    "MERGE",
    "REASSIGN",
    "REINDEX",
    "RENAME",
    "REVOKE",
    "TRUNCATE",
    "UPDATE",
    "VACUUM",
}
WRITE_REGEX = re.compile(r"\b(" + "|".join(sorted(WRITE_VERBS)) + r")\b", re.IGNORECASE)
IDENTIFIER_REGEX = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")
MAX_ROWS = 1000

TABLES_SQL = """
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name
"""

SCHEMA_SQL = """
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = %s
  AND table_name = %s
ORDER BY ordinal_position
"""


@dataclass(frozen=True)
class ServerConfig:
    dsn: str
    host: str


MCP = FastMCP(
    "directstock-postgres",
    instructions=(
        "Read-only PostgreSQL MCP server for DirectStock. "
        "Use `query` for SELECT-style diagnostics and table schema resources "
        "under postgres://<host>/<table>/schema."
    ),
)
CONFIG: ServerConfig | None = None


def structured_error(code: str, message: str, *, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
    }


def _strip_comments(sql: str) -> str:
    without_line_comments = re.sub(r"--[^\n]*", " ", sql)
    return re.sub(r"/\*.*?\*/", " ", without_line_comments, flags=re.DOTALL)


def _reject_mutating_sql(sql: str) -> dict[str, Any] | None:
    statement = _strip_comments(sql).strip()
    if not statement:
        return structured_error("EMPTY_SQL", "SQL must not be empty.")
    match = WRITE_REGEX.search(statement)
    if match:
        return structured_error(
            "WRITE_BLOCKED",
            f"Mutating SQL is blocked for read-only MCP access (detected verb: {match.group(1).upper()}).",
            details={"blocked_verb": match.group(1).upper()},
        )
    return None


def _get_config() -> ServerConfig:
    if CONFIG is None:
        raise RuntimeError("Server configuration has not been initialized.")
    return CONFIG


def _connect() -> psycopg.Connection:
    cfg = _get_config()
    return psycopg.connect(cfg.dsn, row_factory=dict_row, autocommit=False)


def _parse_table_identifier(table: str) -> tuple[str, str]:
    raw = table.strip()
    if not raw:
        raise ValueError("Table identifier must not be empty.")

    parts = raw.split(".", 1)
    if len(parts) == 2:
        schema, name = parts[0].strip(), parts[1].strip()
    else:
        schema, name = "public", parts[0].strip()

    if not IDENTIFIER_REGEX.match(schema) or not IDENTIFIER_REGEX.match(name):
        raise ValueError("Table identifier must use unquoted schema/table names (letters, digits, _, $).")
    return schema, name


def _ensure_expected_host(host: str) -> None:
    expected = _get_config().host
    if host != expected:
        raise ValueError(f"Unsupported host '{host}'. Expected '{expected}'.")


def _fetch_table_rows() -> list[dict[str, str]]:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN READ ONLY")
            cur.execute(TABLES_SQL)
            rows = list(cur.fetchall())
        conn.rollback()
    return rows


@MCP.tool()
def query(sql: str) -> dict[str, Any]:
    maybe_error = _reject_mutating_sql(sql)
    if maybe_error is not None:
        return maybe_error

    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("BEGIN READ ONLY")
                cur.execute(sql)
                columns = [column.name for column in cur.description] if cur.description else []
                rows: list[dict[str, Any]] = []
                truncated = False
                if columns:
                    fetched = list(cur.fetchmany(MAX_ROWS + 1))
                    if len(fetched) > MAX_ROWS:
                        rows = fetched[:MAX_ROWS]
                        truncated = True
                    else:
                        rows = fetched
                conn.rollback()

        return {
            "ok": True,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "truncated": truncated,
            "max_rows": MAX_ROWS,
        }
    except psycopg.Error as exc:
        return structured_error(
            "DB_ERROR",
            str(exc).strip() or "Database query failed.",
            details={"exception_type": exc.__class__.__name__},
        )


@MCP.resource("postgres://{host}/tables")
def list_tables(host: str) -> dict[str, Any]:
    _ensure_expected_host(host)
    rows = _fetch_table_rows()
    table_names = [
        f"{row['table_schema']}.{row['table_name']}" if row["table_schema"] != "public" else row["table_name"]
        for row in rows
    ]
    return {
        "host": host,
        "tables": table_names,
        "count": len(table_names),
    }


@MCP.resource("postgres://{host}/{table}/schema")
def table_schema(host: str, table: str) -> dict[str, Any]:
    _ensure_expected_host(host)
    schema_name, table_name = _parse_table_identifier(table)

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN READ ONLY")
            cur.execute(SCHEMA_SQL, (schema_name, table_name))
            rows = list(cur.fetchall())
        conn.rollback()

    if not rows:
        raise ValueError(f"Table not found: {schema_name}.{table_name}")

    return {
        "host": host,
        "schema": schema_name,
        "table": table_name,
        "columns": rows,
        "uri": f"postgres://{host}/{table}/schema",
    }


def _build_config(dsn: str, *, require_readonly: bool) -> ServerConfig:
    parsed = urlparse(dsn)
    if not parsed.scheme.startswith("postgres"):
        raise ValueError("MCP_POSTGRES_DSN must be a PostgreSQL URL.")

    username = parsed.username or ""
    if require_readonly and not username.endswith("_ro"):
        raise ValueError(f"MCP PostgreSQL user '{username or '<empty>'}' must end with '_ro'.")

    host = parsed.hostname or "localhost"
    return ServerConfig(dsn=dsn, host=host)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="DirectStock in-repo PostgreSQL MCP server.")
    parser.add_argument("dsn", nargs="?", help="PostgreSQL DSN. Falls back to MCP_POSTGRES_DSN.")
    parser.add_argument(
        "--require-readonly",
        choices=("0", "1"),
        default="1",
        help="Require DSN user suffix _ro (default: 1).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dsn = (args.dsn or os.environ.get("MCP_POSTGRES_DSN", "")).strip()
    if not dsn:
        return_code = 2
        print(json.dumps(structured_error("MISSING_DSN", "Provide a PostgreSQL DSN via argument or MCP_POSTGRES_DSN.")))
        return return_code

    try:
        global CONFIG
        CONFIG = _build_config(dsn, require_readonly=args.require_readonly == "1")
    except ValueError as exc:
        print(json.dumps(structured_error("INVALID_DSN", str(exc))))
        return 2

    MCP.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
