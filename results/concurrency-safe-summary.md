# JTL summary: C:\Users\monica.oguntona\Downloads\TestJedi-JMeter-Assignment\TestJedi-JMeter-Assignment\results\concurrency-safe.jtl

Test window: 2026-11-25T08:37:03.345Z -> 2026-11-25T08:37:03.851Z (0.5 s)  
Peak active threads seen in samples: 2
_Totals include Transaction Controller rows, like the JMeter dashboard._

## Overall metrics (Part G)

| Metric | Your result |
|---|---|
| Total requests/samples | 12 |
| Average response time | 47.2 ms |
| Median response time | 43 ms |
| 90th percentile | 90 ms |
| 95th percentile | 147 ms |
| 99th percentile | 147 ms |
| Throughput | 23.7 req/s |
| Error percentage | 0 % (0 failed) |
| Slowest endpoint (highest p95) | Withdraw (synchronised) (p95 147 ms, avg 118.5 ms) |
| Most error-prone endpoint | none - no endpoint had errors |

## Per-endpoint

| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |
|---|---|---|---|---|---|---|---|---|
| Reset mock state | 1 | 61 | 61 | 61 | 61 | 61 | 61 | 0 |
| Set race account balance | 1 | 4 | 4 | 4 | 4 | 4 | 4 | 0 |
| Login | 4 | 41 | 42 | 49 | 49 | 49 | 49 | 0 |
| Withdraw (synchronised) | 2 | 118.5 | 90 | 147 | 147 | 147 | 147 | 0 |
| Initiate Transfer (same Idempotency-Key) | 2 | 47.5 | 47 | 48 | 48 | 48 | 48 | 0 |
| VERIFY race account (out-of-band admin endpoint) | 1 | 3 | 3 | 3 | 3 | 3 | 3 | 0 |
| VERIFY idempotent transfer applied once | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 0 |

(times in ms)

## Acceptance criteria

No criteria supplied (`--criteria`). **No pass/fail verdict can be made without a defined threshold.**
