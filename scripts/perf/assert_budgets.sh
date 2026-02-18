#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

MANIFEST_FILE="${ROOT_DIR}/docs/validation/metrics/perf-results/latest-manifest.tsv"
OUTPUT_FILE="${ROOT_DIR}/docs/validation/metrics/perf-latest.md"
CORE_P95_MS="${CORE_P95_MS:-400}"
REPORTS_P95_MS="${REPORTS_P95_MS:-900}"
MAX_ERROR_RATE="${MAX_ERROR_RATE:-0.01}"

if [[ ! -f "${MANIFEST_FILE}" ]]; then
  echo "Missing manifest: ${MANIFEST_FILE}" >&2
  echo "Run ./scripts/perf/run_perf_smoke.sh first." >&2
  exit 1
fi

python3 - <<'PY' "${MANIFEST_FILE}" "${OUTPUT_FILE}" "${CORE_P95_MS}" "${REPORTS_P95_MS}" "${MAX_ERROR_RATE}"
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

manifest_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
core_budget = float(sys.argv[3])
reports_budget = float(sys.argv[4])
max_error_rate = float(sys.argv[5])

scenario_budgets = {
    "goods_receipt": core_budget,
    "returns": core_budget,
    "picking": core_budget,
    "reports": reports_budget,
}

rows: list[dict[str, object]] = []
violations: list[str] = []

for line in manifest_path.read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    scenario, file_path = line.split("\t", 1)
    data = json.loads(Path(file_path).read_text(encoding="utf-8"))
    metrics = data.get("metrics", {})

    duration_values = metrics.get("http_req_duration", {}).get("values", {})
    failed_values = metrics.get("http_req_failed", {}).get("values", {})

    p95_ms = float(duration_values.get("p(95)", 0.0))
    p99_ms = float(duration_values.get("p(99)", 0.0))
    error_rate = float(failed_values.get("rate", 0.0))

    budget_ms = scenario_budgets.get(scenario, core_budget)
    within_latency = p95_ms <= budget_ms
    within_errors = error_rate <= max_error_rate

    if not within_latency:
        violations.append(f"{scenario}: p95 {p95_ms:.2f}ms exceeds {budget_ms:.2f}ms")
    if not within_errors:
        violations.append(f"{scenario}: error rate {error_rate * 100:.2f}% exceeds {max_error_rate * 100:.2f}%")

    rows.append(
        {
            "scenario": scenario,
            "file": file_path,
            "p95_ms": p95_ms,
            "p99_ms": p99_ms,
            "error_rate": error_rate,
            "budget_ms": budget_ms,
            "latency_ok": within_latency,
            "error_ok": within_errors,
        }
    )

rows.sort(key=lambda item: str(item["scenario"]))

with output_path.open("w", encoding="utf-8") as out:
    out.write("# Performance Budget Snapshot\n\n")
    out.write(f"Generated at: {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}\n\n")
    out.write("## Budget Targets\n\n")
    out.write(f"- Core endpoints p95: <= {core_budget:.2f}ms\n")
    out.write(f"- Reports endpoints p95: <= {reports_budget:.2f}ms\n")
    out.write(f"- Max error rate: <= {max_error_rate * 100:.2f}%\n\n")
    out.write("## Scenario Results\n\n")
    out.write("| Scenario | p95 (ms) | p99 (ms) | Error rate | Budget (ms) | Status |\n")
    out.write("| --- | ---: | ---: | ---: | ---: | --- |\n")
    for row in rows:
        status = "PASS" if row["latency_ok"] and row["error_ok"] else "FAIL"
        out.write(
            f"| {row['scenario']} | {row['p95_ms']:.2f} | {row['p99_ms']:.2f} | "
            f"{row['error_rate'] * 100:.2f}% | {row['budget_ms']:.2f} | {status} |\n"
        )

    out.write("\n## Raw Result Files\n\n")
    for row in rows:
        out.write(f"- `{row['file']}`\n")

    if violations:
        out.write("\n## Violations\n\n")
        for violation in violations:
            out.write(f"- {violation}\n")

print(f"Wrote {output_path}")

if violations:
    print("\n".join(violations), file=sys.stderr)
    raise SystemExit(1)
PY
