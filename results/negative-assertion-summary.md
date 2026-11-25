# JTL summary: C:\Users\monica.oguntona\Downloads\TestJedi-JMeter-Assignment\TestJedi-JMeter-Assignment\results\negative-assertion.jtl

Test window: 2026-11-20T13:29:51.560Z -> 2026-11-20T13:29:54.263Z (2.7 s)  
Peak active threads seen in samples: 1
_Totals include Transaction Controller rows, like the JMeter dashboard._

## Overall metrics (Part G)

| Metric | Your result |
|---|---|
| Total requests/samples | 11 |
| Average response time | 42.5 ms |
| Median response time | 33 ms |
| 90th percentile | 65 ms |
| 95th percentile | 88 ms |
| 99th percentile | 88 ms |
| Throughput | 4.1 req/s |
| Error percentage | 9.1 % (1 failed) |
| Slowest endpoint (highest p95) | Login (p95 88 ms, avg 88 ms) |
| Most error-prone endpoint | Get Profile (100 %) |

## Per-endpoint

| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |
|---|---|---|---|---|---|---|---|---|
| Login | 1 | 88 | 88 | 88 | 88 | 88 | 88 | 0 |
| Debug Sampler - extracted variables | 1 | 5 | 5 | 5 | 5 | 5 | 5 | 0 |
| Get Profile | 1 | 32 | 32 | 32 | 32 | 32 | 32 | 100 |
| Update Profile (PUT) | 1 | 49 | 49 | 49 | 49 | 49 | 49 | 0 |
| Get Account Balance | 1 | 50 | 50 | 50 | 50 | 50 | 50 | 0 |
| Get Transaction History | 1 | 48 | 48 | 48 | 48 | 48 | 48 | 0 |
| Initiate Transfer | 1 | 32 | 32 | 32 | 32 | 32 | 32 | 0 |
| Get Transfer Status | 1 | 33 | 33 | 33 | 33 | 33 | 33 | 0 |
| Transfer Flow (Transaction Controller) *(tx)* | 1 | 65 | 65 | 65 | 65 | 65 | 65 | 0 |
| Add Beneficiary (POST) | 1 | 33 | 33 | 33 | 33 | 33 | 33 | 0 |
| Delete Beneficiary (DELETE) | 1 | 32 | 32 | 32 | 32 | 32 | 32 | 0 |

(times in ms)

## Failure reasons (top 8)

| Count | Response code | Failure message |
|---|---|---|
| 1 | 200 |  |

## Acceptance criteria

No criteria supplied (`--criteria`). **No pass/fail verdict can be made without a defined threshold.**
