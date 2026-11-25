# JTL summary: C:\Users\monica.oguntona\Downloads\TestJedi-JMeter-Assignment\TestJedi-JMeter-Assignment\results\data-exhaustion.jtl

Test window: 2026-11-20T13:30:20.997Z -> 2026-11-20T13:30:23.797Z (2.8 s)  
Peak active threads seen in samples: 3
_Totals include Transaction Controller rows, like the JMeter dashboard._

## Overall metrics (Part G)

| Metric | Your result |
|---|---|
| Total requests/samples | 30 |
| Average response time | 51.6 ms |
| Median response time | 48 ms |
| 90th percentile | 84 ms |
| 95th percentile | 113 ms |
| 99th percentile | 113 ms |
| Throughput | 10.7 req/s |
| Error percentage | 0 % (0 failed) |
| Slowest endpoint (highest p95) | Login (p95 113 ms, avg 89.3 ms) |
| Most error-prone endpoint | none - no endpoint had errors |

## Per-endpoint

| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |
|---|---|---|---|---|---|---|---|---|
| Login | 3 | 89.3 | 113 | 113 | 113 | 113 | 113 | 0 |
| Get Profile | 3 | 50.7 | 50 | 53 | 53 | 53 | 53 | 0 |
| Update Profile (PUT) | 3 | 44.3 | 49 | 50 | 50 | 50 | 50 | 0 |
| Get Account Balance | 3 | 37.7 | 33 | 48 | 48 | 48 | 48 | 0 |
| Get Transaction History | 3 | 41.3 | 37 | 53 | 53 | 53 | 53 | 0 |
| Initiate Transfer | 3 | 40 | 37 | 50 | 50 | 50 | 50 | 0 |
| Get Transfer Status | 3 | 44 | 48 | 51 | 51 | 51 | 51 | 0 |
| Transfer Flow (Transaction Controller) *(tx)* | 3 | 84 | 84 | 98 | 98 | 98 | 98 | 0 |
| Add Beneficiary (POST) | 3 | 49.7 | 50 | 57 | 57 | 57 | 57 | 0 |
| Delete Beneficiary (DELETE) | 3 | 35.3 | 35 | 38 | 38 | 38 | 38 | 0 |

(times in ms)

## Acceptance criteria

No criteria supplied (`--criteria`). **No pass/fail verdict can be made without a defined threshold.**
