# Performance Budget Snapshot

Generated at: 2026-02-18T20:32:29.160018Z

## Budget Targets

- Core endpoints p95: <= 400.00ms
- Reports endpoints p95: <= 900.00ms
- Max error rate: <= 1.00%

## Scenario Results

| Scenario | Requests | p95 (ms) | p99 (ms) | Error rate | Budget (ms) | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| goods_receipt | 169 | 44.76 | 249.84 | 0.00% | 400.00 | PASS |
| picking | 177 | 32.78 | 243.90 | 0.00% | 400.00 | PASS |
| reports | 88 | 36.68 | 265.00 | 0.00% | 900.00 | PASS |
| returns | 167 | 50.38 | 247.18 | 0.00% | 400.00 | PASS |

## Raw Result Files

- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/goods_receipt-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/picking-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/reports-smoke.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/metrics/perf-results/returns-smoke.json`
