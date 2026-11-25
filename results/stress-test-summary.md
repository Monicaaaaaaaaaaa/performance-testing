# JTL summary: C:\Users\monica.oguntona\Downloads\TestJedi-JMeter-Assignment\TestJedi-JMeter-Assignment\results\stress-test.jtl

Test window: 2026-11-20T14:13:27.420Z -> 2026-11-20T14:19:37.178Z (369.8 s)  
Peak active threads seen in samples: 70
_Totals include Transaction Controller rows, like the JMeter dashboard._

## Overall metrics (Part G)

| Metric | Your result |
|---|---|
| Total requests/samples | 90000 |
| Average response time | 54.5 ms |
| Median response time | 48 ms |
| 90th percentile | 83 ms |
| 95th percentile | 102 ms |
| 99th percentile | 213 ms |
| Throughput | 243.4 req/s |
| Error percentage | 0 % (0 failed) |
| Slowest endpoint (highest p95) | Login (p95 73 ms, avg 49.8 ms) |
| Most error-prone endpoint | none - no endpoint had errors |

## Per-endpoint

| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |
|---|---|---|---|---|---|---|---|---|
| Login | 9000 | 49.8 | 47 | 64 | 73 | 192 | 403 | 0 |
| Get Profile | 9000 | 49.2 | 47 | 63 | 71 | 182 | 465 | 0 |
| Update Profile (PUT) | 9000 | 49.3 | 47 | 63 | 71 | 187 | 425 | 0 |
| Get Account Balance | 9000 | 49.4 | 47 | 63 | 71 | 190 | 434 | 0 |
| Get Transaction History | 9000 | 49.5 | 47 | 63 | 71 | 203 | 438 | 0 |
| Initiate Transfer | 9000 | 50.1 | 48 | 64 | 72 | 198 | 459 | 0 |
| Get Transfer Status | 9000 | 49.4 | 47 | 63 | 70 | 190 | 467 | 0 |
| Transfer Flow (Transaction Controller) *(tx)* | 9000 | 99.5 | 91 | 117 | 134 | 403 | 789 | 0 |
| Add Beneficiary (POST) | 9000 | 49.4 | 47 | 63 | 71 | 190 | 408 | 0 |
| Delete Beneficiary (DELETE) | 9000 | 49.3 | 47 | 63 | 71 | 191 | 471 | 0 |

(times in ms)

## Acceptance criteria

| Criterion | Measured | Verdict |
|---|---|---|
| p95<=500 | 102 | **PASS** |
| errorPct<=1 | 0 | **PASS** |
