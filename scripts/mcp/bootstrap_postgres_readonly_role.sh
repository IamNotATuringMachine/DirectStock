#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to bootstrap read-only MCP role." >&2
  exit 1
fi

if [ -f "${ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

db_host="${POSTGRES_HOST:-localhost}"
db_port="${POSTGRES_PORT:-5432}"
db_name="${POSTGRES_DB:-directstock_clean}"
db_user="${POSTGRES_USER:-directstock}"
db_password="${POSTGRES_PASSWORD:-directstock}"
ro_user="${MCP_POSTGRES_RO_USER:-directstock_ro}"
ro_password="${MCP_POSTGRES_RO_PASSWORD:-directstock_ro}"

if [[ ! "${ro_user}" =~ _ro$ ]]; then
  echo "Read-only role must end with '_ro' (got '${ro_user}')." >&2
  exit 1
fi

export PGPASSWORD="${db_password}"
admin_dsn="postgresql://${db_user}@${db_host}:${db_port}/${db_name}"

psql "${admin_dsn}" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ro_user}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${ro_user}', '${ro_password}');
  ELSE
    EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L', '${ro_user}', '${ro_password}');
  END IF;
END
\$\$;

GRANT CONNECT ON DATABASE ${db_name} TO ${ro_user};
GRANT USAGE ON SCHEMA public TO ${ro_user};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ro_user};
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ro_user};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${ro_user};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${ro_user};
SQL

echo "Read-only MCP role '${ro_user}' is ready."
echo "Suggested MCP_POSTGRES_DSN=postgresql://${ro_user}:${ro_password}@${db_host}:${db_port}/${db_name}"
