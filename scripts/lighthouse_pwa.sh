#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/artifacts/lighthouse"
REPORT_BASE="$ARTIFACT_DIR/lighthouse"
REPORT_JSON="$REPORT_BASE.report.json"
THRESHOLD="${LIGHTHOUSE_PWA_THRESHOLD:-0.90}"
TARGET_URL="${LIGHTHOUSE_TARGET_URL:-http://localhost:8080}"

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  docker compose -f "$ROOT_DIR/docker-compose.prod.yml" down >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[lighthouse] Starting prod stack..."
docker compose -f "$ROOT_DIR/docker-compose.prod.yml" up -d --build

echo "[lighthouse] Waiting for health endpoint..."
for _ in $(seq 1 60); do
  if [[ "$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/health" || true)" == "200" ]]; then
    break
  fi
  sleep 1
done

if [[ "$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/health" || true)" != "200" ]]; then
  echo "[lighthouse] Health check failed for $TARGET_URL/health"
  exit 1
fi

echo "[lighthouse] Running Lighthouse PWA audit..."
npx --yes lighthouse@10 "$TARGET_URL" \
  --only-categories=pwa \
  --output=json \
  --output=html \
  --output-path="$REPORT_BASE" \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"

echo "[lighthouse] Validating score >= $THRESHOLD ..."
node "$ROOT_DIR/scripts/check_lighthouse_score.mjs" "$REPORT_JSON" "$THRESHOLD"

echo "[lighthouse] Done. Reports:"
echo "- $REPORT_JSON"
echo "- $REPORT_BASE.report.html"
