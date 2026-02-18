# Performance Budget Snapshot

Generated at: 2026-02-18T19:48:02.385925Z

## Budget Targets

- Core endpoints p95: <= 400.00ms
- Reports endpoints p95: <= 900.00ms
- Max error rate: <= 1.00%

## Scenario Results

| Scenario | Requests | p95 (ms) | p99 (ms) | Error rate | Budget (ms) | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| goods_receipt | 171 | 43.03 | 276.13 | 0.00% | 400.00 | PASS |
| picking | 179 | 31.28 | 255.34 | 0.00% | 400.00 | PASS |
| reports | 90 | 33.29 | 288.62 | 0.00% | 900.00 | PASS |
| returns | 173 | 42.68 | 273.82 | 0.00% | 400.00 | PASS |

## Raw Result Files

- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/goods_receipt-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/picking-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/reports-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/returns-smoke.json`
