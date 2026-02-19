# Performance Budget Snapshot

Generated at: 2026-02-19T09:20:39.286564Z

## Budget Targets

- Core endpoints p95: <= 400.00ms
- Reports endpoints p95: <= 900.00ms
- Max error rate: <= 1.00%

## Scenario Results

| Scenario | Requests | p95 (ms) | p99 (ms) | Error rate | Budget (ms) | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| goods_receipt | 171 | 40.56 | 260.59 | 0.00% | 400.00 | PASS |
| picking | 179 | 28.59 | 281.84 | 0.00% | 400.00 | PASS |
| reports | 91 | 26.54 | 273.28 | 0.00% | 900.00 | PASS |
| returns | 173 | 38.38 | 285.51 | 0.58% | 400.00 | PASS |

## Raw Result Files

- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/goods_receipt-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/picking-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/reports-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/returns-smoke.json`
