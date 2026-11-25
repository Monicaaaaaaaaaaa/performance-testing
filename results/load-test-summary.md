# JTL summary: C:\Users\monica.oguntona\Downloads\TestJedi-JMeter-Assignment\TestJedi-JMeter-Assignment\results\load-test.jtl

Test window: 2026-11-20T13:32:28.856Z -> 2026-11-20T13:39:09.676Z (400.8 s)  
Peak active threads seen in samples: 10
_Totals include Transaction Controller rows, like the JMeter dashboard._

## Overall metrics (Part G)

| Metric | Your result |
|---|---|
| Total requests/samples | 7000 |
| Average response time | 48.3 ms |
| Median response time | 48 ms |
| 90th percentile | 67 ms |
| 95th percentile | 85 ms |
| 99th percentile | 112 ms |
| Throughput | 17.5 req/s |
| Error percentage | 0 % (0 failed) |
| Slowest endpoint (highest p95) | Login (p95 64 ms, avg 43.9 ms) |
| Most error-prone endpoint | none - no endpoint had errors |

## Per-endpoint

| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |
|---|---|---|---|---|---|---|---|---|
| Login | 700 | 43.9 | 48 | 53 | 64 | 69 | 159 | 0 |
| Get Profile | 700 | 43.8 | 48 | 53 | 64 | 67 | 113 | 0 |
| Update Profile (PUT) | 700 | 43.8 | 48 | 52 | 64 | 70 | 160 | 0 |
| Get Account Balance | 700 | 43.9 | 48 | 52 | 64 | 67 | 102 | 0 |
| Get Transaction History | 700 | 43 | 48 | 50 | 64 | 67 | 183 | 0 |
| Initiate Transfer | 700 | 44.4 | 48 | 52 | 64 | 71 | 170 | 0 |
| Get Transfer Status | 700 | 44.2 | 48 | 52 | 64 | 73 | 201 | 0 |
| Transfer Flow (Transaction Controller) *(tx)* | 700 | 88.5 | 83 | 103 | 113 | 170 | 248 | 0 |
| Add Beneficiary (POST) | 700 | 43.8 | 48 | 52 | 64 | 66 | 124 | 0 |
| Delete Beneficiary (DELETE) | 700 | 44 | 48 | 51 | 64 | 69 | 179 | 0 |

(times in ms)

## Acceptance criteria

| Criterion | Measured | Verdict |
|---|---|---|
| p95<=500 | 85 | **PASS** |
| errorPct<=1 | 0 | **PASS** |
