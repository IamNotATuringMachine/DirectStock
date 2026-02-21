#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_SUFFIX="$(date +%s)_$RANDOM"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-directstock_e2e_${PROJECT_SUFFIX}}"
POSTGRES_DB="${POSTGRES_DB:-directstock_e2e_${PROJECT_SUFFIX}}"
POSTGRES_PORT="${POSTGRES_PORT:-$((25000 + RANDOM % 2000))}"
NGINX_PORT="${NGINX_PORT:-$((18080 + RANDOM % 1000))}"
E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:${NGINX_PORT}}"
E2E_RAW_SCRIPT="${E2E_RAW_SCRIPT:-test:e2e:raw}"
PLAYWRIGHT_OUTPUT_DIR="${PLAYWRIGHT_OUTPUT_DIR:-}"
PLAYWRIGHT_DOCKER_IMAGE="${PLAYWRIGHT_DOCKER_IMAGE:-}"
PLAYWRIGHT_DOCKER_WORKDIR="${PLAYWRIGHT_DOCKER_WORKDIR:-/work/frontend}"
PLAYWRIGHT_DOCKER_NODE_MODULES_VOLUME="${PLAYWRIGHT_DOCKER_NODE_MODULES_VOLUME:-directstock_e2e_node_modules}"
PLAYWRIGHT_DOCKER_NPM_CACHE_VOLUME="${PLAYWRIGHT_DOCKER_NPM_CACHE_VOLUME:-directstock_e2e_npm_cache}"
PLAYWRIGHT_DOCKER_BUILD_CMD="${PLAYWRIGHT_DOCKER_BUILD_CMD:-npm ci --no-audit --no-fund}"

export POSTGRES_DB
export POSTGRES_PORT
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://directstock:directstock@postgres:5432/${POSTGRES_DB}}"
export ASYNC_DATABASE_URL="${ASYNC_DATABASE_URL:-postgresql+asyncpg://directstock:directstock@postgres:5432/${POSTGRES_DB}}"
export NGINX_PORT
export E2E_BASE_URL
export SEED_ON_START="${SEED_ON_START:-true}"
export DIRECTSTOCK_ADMIN_PASSWORD="${DIRECTSTOCK_ADMIN_PASSWORD:-DirectStock2026!}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-${DIRECTSTOCK_ADMIN_PASSWORD}}"
export E2E_KEEP_ARTIFACTS="${E2E_KEEP_ARTIFACTS:-0}"
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"

if [ -z "${PLAYWRIGHT_OUTPUT_DIR}" ]; then
  keep_artifacts_normalized="$(printf '%s' "${E2E_KEEP_ARTIFACTS}" | tr '[:upper:]' '[:lower:]')"
  if [ "${E2E_KEEP_ARTIFACTS}" = "1" ] || [ "${keep_artifacts_normalized}" = "true" ]; then
    PLAYWRIGHT_OUTPUT_DIR="/work/frontend/test-results/run-${COMPOSE_PROJECT_NAME}"
  else
    PLAYWRIGHT_OUTPUT_DIR="/tmp/directstock-playwright-${COMPOSE_PROJECT_NAME}"
  fi
fi
export PLAYWRIGHT_OUTPUT_DIR

COMPOSE_ARGS=(
  -p "${COMPOSE_PROJECT_NAME}"
  -f "${ROOT_DIR}/docker-compose.yml"
)

cleanup() {
  local exit_code=$?
  if [ "${exit_code}" -ne 0 ]; then
    echo "E2E run failed. Last backend logs:"
    docker compose "${COMPOSE_ARGS[@]}" logs --no-color --tail=200 backend || true
    echo "E2E run failed. Last frontend logs:"
    docker compose "${COMPOSE_ARGS[@]}" logs --no-color --tail=200 frontend || true
  fi

  echo "Stopping isolated stack ${COMPOSE_PROJECT_NAME} (down -v)..."
  docker compose "${COMPOSE_ARGS[@]}" down -v --remove-orphans || true
}
trap cleanup EXIT

start_isolated_stack() {
  if docker compose "${COMPOSE_ARGS[@]}" up -d --build; then
    return 0
  fi

  docker compose "${COMPOSE_ARGS[@]}" down -v --remove-orphans || true
  echo "Compose build failed. Retrying with prebuilt fallback images..."
  if docker image inspect "directstock-backend:latest" >/dev/null 2>&1 && docker image inspect "directstock-frontend:latest" >/dev/null 2>&1; then
    docker tag "directstock-backend:latest" "${COMPOSE_PROJECT_NAME}-backend:latest"
    docker tag "directstock-frontend:latest" "${COMPOSE_PROJECT_NAME}-frontend:latest"
    docker compose "${COMPOSE_ARGS[@]}" up -d --no-build --force-recreate
    return 0
  fi

  echo "Fallback images directstock-backend:latest and directstock-frontend:latest not found."
  return 1
}

docker_reachable_base_url() {
  local base_url="$1"
  base_url="${base_url/localhost/host.docker.internal}"
  base_url="${base_url/127.0.0.1/host.docker.internal}"
  printf "%s" "${base_url}"
}

resolve_playwright_docker_image() {
  if [ -n "${PLAYWRIGHT_DOCKER_IMAGE}" ]; then
    printf "%s" "${PLAYWRIGHT_DOCKER_IMAGE}"
    return 0
  fi

  local playwright_version
  playwright_version="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const v=p.packages?.['node_modules/@playwright/test']?.version || p.dependencies?.['@playwright/test']?.version || '';if(!v){process.exit(1);}process.stdout.write(v);" "${ROOT_DIR}/frontend/package-lock.json")"
  printf "mcr.microsoft.com/playwright:v%s-jammy" "${playwright_version}"
}

run_playwright_in_docker() {
  local docker_base_url
  local playwright_image
  local extra_args=""
  docker_base_url="$(docker_reachable_base_url "${E2E_BASE_URL}")"
  playwright_image="$(resolve_playwright_docker_image)"

  if [ "$#" -gt 0 ]; then
    extra_args="$(printf ' %q' "$@")"
  fi

  docker run --rm \
    --add-host=host.docker.internal:host-gateway \
    -e E2E_BASE_URL="${docker_base_url}" \
    -e E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD}" \
    -e E2E_ADMIN_USERNAME="${E2E_ADMIN_USERNAME:-admin}" \
    -e E2E_KEEP_ARTIFACTS="${E2E_KEEP_ARTIFACTS}" \
    -e PLAYWRIGHT_OUTPUT_DIR="${PLAYWRIGHT_OUTPUT_DIR}" \
    -e CI="${CI:-1}" \
    -v "${ROOT_DIR}:/work" \
    -v "${PLAYWRIGHT_DOCKER_NODE_MODULES_VOLUME}:/work/frontend/node_modules" \
    -v "${PLAYWRIGHT_DOCKER_NPM_CACHE_VOLUME}:/root/.npm" \
    -w "${PLAYWRIGHT_DOCKER_WORKDIR}" \
    "${playwright_image}" \
    bash -lc "set -euo pipefail; ${PLAYWRIGHT_DOCKER_BUILD_CMD}; npm run \"${E2E_RAW_SCRIPT}\" --${extra_args}"
}

echo "Starting isolated stack ${COMPOSE_PROJECT_NAME} on ${E2E_BASE_URL}"
start_isolated_stack

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

run_playwright_in_docker "$@"
