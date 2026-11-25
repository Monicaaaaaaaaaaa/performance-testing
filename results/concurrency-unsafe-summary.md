# JTL summary: C:\Users\monica.oguntona\Downloads\TestJedi-JMeter-Assignment\TestJedi-JMeter-Assignment\results\concurrency-unsafe.jtl

Test window: 2026-11-20T13:40:14.128Z -> 2026-11-20T13:40:14.622Z (0.5 s)  
Peak active threads seen in samples: 2
_Totals include Transaction Controller rows, like the JMeter dashboard._

## Overall metrics (Part G)

| Metric | Your result |
|---|---|
| Total requests/samples | 12 |
| Average response time | 43.6 ms |
| Median response time | 42 ms |
| 90th percentile | 95 ms |
| 95th percentile | 95 ms |
| 99th percentile | 95 ms |
| Throughput | 24.3 req/s |
| Error percentage | 8.3 % (1 failed) |
| Slowest endpoint (highest p95) | Withdraw (synchronised) (p95 95 ms, avg 95 ms) |
| Most error-prone endpoint | VERIFY race account (out-of-band admin endpoint) (100 %) |

## Per-endpoint

| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |
|---|---|---|---|---|---|---|---|---|
| Reset mock state | 1 | 75 | 75 | 75 | 75 | 75 | 75 | 0 |
| Set race account balance | 1 | 4 | 4 | 4 | 4 | 4 | 4 | 0 |
| Login | 4 | 43.3 | 42 | 61 | 61 | 61 | 61 | 0 |
| Withdraw (synchronised) | 2 | 95 | 95 | 95 | 95 | 95 | 95 | 0 |
| Initiate Transfer (same Idempotency-Key) | 2 | 37 | 29 | 45 | 45 | 45 | 45 | 0 |
| VERIFY race account (out-of-band admin endpoint) | 1 | 5 | 5 | 5 | 5 | 5 | 5 | 100 |
| VERIFY idempotent transfer applied once | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 0 |

(times in ms)

## Failure reasons (top 8)

| Count | Response code | Failure message |
|---|---|---|
| 1 | 200 | Value in json path '$.data.withdrawals' expected to be '1', but found '2' |

## Acceptance criteria

No criteria supplied (`--criteria`). **No pass/fail verdict can be made without a defined threshold.**
