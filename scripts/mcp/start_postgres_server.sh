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
    dsn="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"
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

host_reachable="$(
python3 - "${dsn}" <<'PY'
import socket
import sys
from urllib.parse import urlparse

try:
    parsed = urlparse(sys.argv[1])
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    with socket.create_connection((host, port), timeout=1.5):
        print("1")
except Exception:
    print("0")
PY
)"

if [ "${host_reachable}" = "1" ]; then
  local_server_entry="$(find "${HOME}/.npm/_npx" -path "*/node_modules/@modelcontextprotocol/server-postgres/dist/index.js" 2>/dev/null | head -n1 || true)"
  if [ -n "${local_server_entry}" ] && command -v node >/dev/null 2>&1; then
    exec node "${local_server_entry}" "${dsn}"
  fi
  exec npx -y @modelcontextprotocol/server-postgres "${dsn}"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "PostgreSQL host from DSN is not reachable and docker fallback is unavailable." >&2
  echo "Set MCP_POSTGRES_DSN to a reachable host or install docker." >&2
  exit 1
fi

compose_cmd=()
if docker compose version >/dev/null 2>&1; then
  compose_cmd=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose_cmd=(docker-compose)
fi

container_id=""
if [ "${#compose_cmd[@]}" -gt 0 ]; then
  container_id="$("${compose_cmd[@]}" -f "${ROOT_DIR}/docker-compose.yml" ps -q postgres 2>/dev/null | head -n1 || true)"
  if [ -z "${container_id}" ]; then
    "${compose_cmd[@]}" -f "${ROOT_DIR}/docker-compose.yml" up -d postgres >/dev/null 2>&1 || true
    container_id="$("${compose_cmd[@]}" -f "${ROOT_DIR}/docker-compose.yml" ps -q postgres 2>/dev/null | head -n1 || true)"
  fi
fi

if [ -z "${container_id}" ]; then
  container_id="$(docker ps -q --filter "name=directstock-postgres" | head -n1 || true)"
fi

if [ -z "${container_id}" ]; then
  echo "Could not find a running DirectStock postgres container for docker-network fallback." >&2
  echo "Start postgres (docker compose up -d postgres) or provide a reachable MCP_POSTGRES_DSN." >&2
  exit 1
fi

docker_network="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{printf "%s\n" $k}}{{end}}' "${container_id}" 2>/dev/null | head -n1 || true)"
if [ -z "${docker_network}" ]; then
  echo "Could not resolve docker network for postgres container ${container_id}." >&2
  exit 1
fi

docker_dsn="$(
python3 - "${dsn}" <<'PY'
import sys
from urllib.parse import urlparse, urlunparse

parsed = urlparse(sys.argv[1])
if not parsed.scheme.startswith("postgres"):
    raise SystemExit(1)

user = parsed.username or ""
password = parsed.password or ""
auth = user
if password:
    auth += f":{password}"
if auth:
    auth += "@"
netloc = f"{auth}postgres:5432"

print(urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment)))
PY
)"

exec docker run --rm -i \
  --network "${docker_network}" \
  -e MCP_POSTGRES_DSN="${docker_dsn}" \
  node:20-alpine \
  sh -lc 'exec npx -y @modelcontextprotocol/server-postgres "$MCP_POSTGRES_DSN"'
