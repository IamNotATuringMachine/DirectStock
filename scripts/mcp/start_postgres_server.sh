#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start postgres MCP server." >&2
  exit 1
fi

dsn="${MCP_POSTGRES_DSN:-}"
if [ -z "${dsn}" ] && [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  if [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_DB:-}" ]; then
    dsn="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
  fi
fi

if [ -z "${dsn}" ]; then
  cat >&2 <<'EOF'
Could not resolve a PostgreSQL DSN for MCP.
Set MCP_POSTGRES_DSN or provide POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB in .env.
EOF
  exit 1
fi

require_postgres_readonly="${MCP_REQUIRE_POSTGRES_READONLY:-1}"
if [ "${require_postgres_readonly}" = "1" ]; then
  dsn_user="$(python3 - "${dsn}" <<'PY'
import sys
from urllib.parse import urlparse

try:
    print(urlparse(sys.argv[1]).username or "")
except Exception:
    print("")
PY
)"
  if [ -z "${dsn_user}" ]; then
    echo "Could not parse MCP PostgreSQL username from DSN." >&2
    exit 1
  fi
  if [[ ! "${dsn_user}" =~ _ro$ ]]; then
    echo "MCP PostgreSQL user '${dsn_user}' must end with '_ro' for read-only policy." >&2
    echo "Use MCP_REQUIRE_POSTGRES_READONLY=0 only for explicit emergency override." >&2
    exit 1
  fi
fi

exec npx -y @modelcontextprotocol/server-postgres "${dsn}"
