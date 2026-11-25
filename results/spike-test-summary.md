# JTL summary: C:\Users\monica.oguntona\Downloads\TestJedi-JMeter-Assignment\TestJedi-JMeter-Assignment\results\spike-test.jtl

Test window: 2026-11-20T14:39:37.140Z -> 2026-11-20T14:45:17.389Z (340.2 s)  
Peak active threads seen in samples: 205
_Totals include Transaction Controller rows, like the JMeter dashboard._

## Overall metrics (Part G)

| Metric | Your result |
|---|---|
| Total requests/samples | 20795 |
| Average response time | 503.1 ms |
| Median response time | 636 ms |
| 90th percentile | 836 ms |
| 95th percentile | 916 ms |
| 99th percentile | 1568 ms |
| Throughput | 61.1 req/s |
| Error percentage | 20.5 % (4259 failed) |
| Slowest endpoint (highest p95) | Initiate Transfer (p95 852 ms, avg 454.4 ms) |
| Most error-prone endpoint | Update Profile (PUT) (85.9 %) |

## Per-endpoint

| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |
|---|---|---|---|---|---|---|---|---|
| Login | 2300 | 467.3 | 639 | 804 | 836 | 884 | 921 | 10.7 |
| Get Profile | 2055 | 450 | 623 | 805 | 839 | 881 | 936 | 9.4 |
| Update Profile (PUT) | 2055 | 445.6 | 622 | 818 | 849 | 896 | 937 | 85.9 |
| Get Account Balance | 2055 | 461.4 | 627 | 802 | 836 | 883 | 968 | 9 |
| Get Transaction History | 2055 | 465.1 | 629 | 797 | 833 | 882 | 926 | 8.3 |
| Initiate Transfer | 2055 | 454.4 | 627 | 816 | 852 | 892 | 932 | 11.3 |
| Get Transfer Status | 2055 | 452.9 | 625 | 805 | 838 | 884 | 949 | 22.6 |
| Transfer Flow (Transaction Controller) *(tx)* | 2055 | 907.3 | 874 | 1570 | 1626 | 1723 | 1805 | 22.6 |
| Add Beneficiary (POST) | 2055 | 473 | 634 | 797 | 825 | 872 | 910 | 8.1 |
| Delete Beneficiary (DELETE) | 2055 | 458.4 | 625 | 801 | 835 | 886 | 948 | 18.2 |

(times in ms)

## Failure reasons (top 8)

| Count | Response code | Failure message |
|---|---|---|
| 1895 | 503 | Test failed: code expected to equal /

****** received  : [[[503]]]

****** comparison: [[ |
| 1506 | 200 |  |
| 464 |  |  |
| 394 | 404 | Test failed: code expected to equal /

****** received  : [[[404]]]

****** comparison: [[ |

## Acceptance criteria

| Criterion | Measured | Verdict |
|---|---|---|
| p95<=500 | 916 | **FAIL** |
| errorPct<=1 | 20.5 | **FAIL** |
