#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_SUFFIX="$(date +%s)_$RANDOM"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-directstock_e2e_${PROJECT_SUFFIX}}"
POSTGRES_DB="${POSTGRES_DB:-directstock_e2e_${PROJECT_SUFFIX}}"
NGINX_PORT="${NGINX_PORT:-$((18080 + RANDOM % 1000))}"
E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:${NGINX_PORT}}"
E2E_RAW_SCRIPT="${E2E_RAW_SCRIPT:-test:e2e:raw}"

export POSTGRES_DB
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://directstock:directstock@postgres:5432/${POSTGRES_DB}}"
export ASYNC_DATABASE_URL="${ASYNC_DATABASE_URL:-postgresql+asyncpg://directstock:directstock@postgres:5432/${POSTGRES_DB}}"
export NGINX_PORT
export E2E_BASE_URL
export SEED_ON_START="${SEED_ON_START:-true}"

COMPOSE_ARGS=(
  -p "${COMPOSE_PROJECT_NAME}"
  -f "${ROOT_DIR}/docker-compose.yml"
)

cleanup() {
  local exit_code=$?
  if [ "${exit_code}" -ne 0 ]; then
    echo "E2E run failed. Last backend logs:"
    docker compose "${COMPOSE_ARGS[@]}" logs --no-color --tail=200 backend || true
  fi

  echo "Stopping isolated stack ${COMPOSE_PROJECT_NAME} (down -v)..."
  docker compose "${COMPOSE_ARGS[@]}" down -v --remove-orphans || true
}
trap cleanup EXIT

echo "Starting isolated stack ${COMPOSE_PROJECT_NAME} on ${E2E_BASE_URL}"
docker compose "${COMPOSE_ARGS[@]}" up -d --build

echo "Waiting for API health at ${E2E_BASE_URL}/api/health"
for _ in $(seq 1 90); do
  if curl -fsS "${E2E_BASE_URL}/api/health" >/dev/null; then
    break
  fi
  sleep 2
done

if ! curl -fsS "${E2E_BASE_URL}/api/health" >/dev/null; then
  echo "API did not become healthy in time."
  exit 1
fi

(
  cd "${ROOT_DIR}/frontend"
  npm run "${E2E_RAW_SCRIPT}" -- "$@"
)
