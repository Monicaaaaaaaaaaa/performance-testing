# JTL summary: C:\Users\monica.oguntona\Downloads\TestJedi-JMeter-Assignment\TestJedi-JMeter-Assignment\results\baseline.jtl

Test window: 2026-11-20T13:16:06.526Z -> 2026-11-20T13:16:29.929Z (23.4 s)  
Peak active threads seen in samples: 1
_Totals include Transaction Controller rows, like the JMeter dashboard._

## Overall metrics (Part G)

| Metric | Your result |
|---|---|
| Total requests/samples | 100 |
| Average response time | 52.7 ms |
| Median response time | 49 ms |
| 90th percentile | 82 ms |
| 95th percentile | 99 ms |
| 99th percentile | 117 ms |
| Throughput | 4.3 req/s |
| Error percentage | 0 % (0 failed) |
| Slowest endpoint (highest p95) | Login (p95 108 ms, avg 53.4 ms) |
| Most error-prone endpoint | none - no endpoint had errors |

## Per-endpoint

| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |
|---|---|---|---|---|---|---|---|---|
| Login | 10 | 53.4 | 48 | 66 | 108 | 108 | 108 | 0 |
| Get Profile | 10 | 44.7 | 45 | 55 | 65 | 65 | 65 | 0 |
| Update Profile (PUT) | 10 | 47.4 | 49 | 50 | 65 | 65 | 65 | 0 |
| Get Account Balance | 10 | 48.7 | 48 | 51 | 64 | 64 | 64 | 0 |
| Get Transaction History | 10 | 47.9 | 48 | 52 | 99 | 99 | 99 | 0 |
| Initiate Transfer | 10 | 46.2 | 49 | 53 | 63 | 63 | 63 | 0 |
| Get Transfer Status | 10 | 51.9 | 49 | 64 | 95 | 95 | 95 | 0 |
| Transfer Flow (Transaction Controller) *(tx)* | 10 | 98.1 | 97 | 117 | 130 | 130 | 130 | 0 |
| Add Beneficiary (POST) | 10 | 41.4 | 35 | 50 | 50 | 50 | 50 | 0 |
| Delete Beneficiary (DELETE) | 10 | 47.1 | 49 | 65 | 65 | 65 | 65 | 0 |

(times in ms)

## Acceptance criteria

| Criterion | Measured | Verdict |
|---|---|---|
| p95<=500 | 99 | **PASS** |
| errorPct<=1 | 0 | **PASS** |
