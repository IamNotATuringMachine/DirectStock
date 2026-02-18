# Performance Budgets (Wave 7A)

## Goals
1. Core API flows stay below p95 400ms in smoke load profile.
2. Reports flow stays below p95 900ms.
3. HTTP error rate stays below 1%.

## Scenario Mapping
- `goods_receipt` -> core budget
- `returns` -> core budget
- `picking` -> core budget
- `reports` -> reports budget

## Commands
```bash
./scripts/perf/run_perf_smoke.sh
./scripts/perf/assert_budgets.sh
```

For full nightly profile:
```bash
PERF_MODE=full ./scripts/perf/run_perf_smoke.sh
./scripts/perf/assert_budgets.sh
```

## Artifacts
- Raw summaries: `docs/validation/metrics/perf-results/*.json`
- Manifest: `docs/validation/metrics/perf-results/latest-manifest.tsv`
- Budget report: `docs/validation/metrics/perf-latest.md`
