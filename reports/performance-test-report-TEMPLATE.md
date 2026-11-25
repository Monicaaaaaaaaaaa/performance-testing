# TestJedi Digital Banking API - Performance & Functional Test Report

**Prepared by:** [FILL: your name] **Date:** [FILL] **Version:** 1.0
**Audience:** Fintech engineering team

> How to use this template: every `[FILL: ...]` must be replaced with a **measured** value or your own observation. Do not leave invented numbers. Where the evidence does not support a claim, write "Inconclusive". Export the finished file to `performance-test-report.pdf`.

---

## 1. Executive summary
[FILL after testing - 5-8 lines: what was tested, headline results, overall verdict, top 3 risks, release recommendation.]

| Area | Result | Basis |
|---|---|---|
| Functional correctness (assertions) | [PASS / FAIL / INCONCLUSIVE] | [FILL: e.g. N assertions, M failures] |
| Response-time criterion (p95 <= 500 ms) | [..] | [FILL: measured p95 per scenario] |
| Error-rate criterion (<= 1 %) | [..] | [FILL] |
| Concurrency safety (withdrawal race) | [..] | [FILL: unsafe vs safe mode result] |
| Capacity limit identified | [..] | [FILL: load level at which degradation began] |

## 2. Application and environment under test
* **Application:** TestJedi mock digital-banking API (Node.js, in-memory data), `mock-api/server.js`.
* **Endpoints tested:** login, profile (GET/PUT), balance, transaction history, transfer (POST) and status, beneficiary (POST/DELETE), withdraw (concurrency), admin state (verification only).
* **Test machine:** [FILL: CPU, RAM, OS], JMeter [FILL: version], Java [FILL], Node [FILL].
* **Network:** loopback (127.0.0.1); load generator and server on the same machine.

## 3. Test objectives and scope
**Objectives:** (1) verify each API returns correct data, (2) verify behaviour under expected, rising and sudden load, (3) verify transaction correctness under concurrency, (4) produce repeatable, evidence-backed results.
**In scope:** the endpoints above. **Out of scope:** real banking backends, security/penetration testing, network latency, server-side resource monitoring, production systems.

## 4. Test environment and assumptions
* Authorised local mock only; no real customers, credentials or money.
* Simulated latency/degradation: base 20-50 ms; extra delay above 25 in-flight requests; 503 responses starting at 120 in-flight (see mock header).
* Test data: 3 fictional users (`test-users.csv`), `recycle=true` for load tests.
* Think time: 200 ms (baseline/stress) or 500 ms (load/spike/endurance).
* Assumption: acceptance criteria below are **assumed** because none were supplied.

## 5. Workload model and acceptance criteria
| ID | Criterion | Threshold | Applies to |
|---|---|---|---|
| AC-1 | All functional assertions pass | 0 failures | functional run |
| AC-2 | 95th percentile response time | <= 500 ms | baseline, load |
| AC-3 | Error rate | <= 1 % | baseline, load |
| AC-4 | No degradation trend over time | [FILL: define, e.g. p95 drift < 20 %] | endurance (if run) |
| AC-5 | Concurrent withdrawals never overdraw or double-debit | exactly 1 debit, ledger total = 800 | concurrency-safe |

Workload per user iteration: Login -> Profile -> Update profile -> Balance -> Transactions -> Transfer + Status -> Add/Delete beneficiary.

## 6. Test scenarios and configurations
| Scenario | Threads | Ramp-up | Loops | Think time | Why this workload | Expected behaviour |
|---|---|---|---|---|---|---|
| Functional | 1 | 1 s | 1 | 200 ms | verify every request/assertion once | all pass |
| Baseline | 1 | 1 s | 10 | 200 ms | establish no-contention reference | fastest times, 0 % errors |
| Load | 10 | 60 s | 70 | 500 ms | represent expected workload [FILL: justify] | within AC-2/AC-3 |
| Stress | up to 300 | 300 s | 30 | 200 ms | find capacity limit | latency rises, then errors |
| Spike | 5 + 200 after 60 s | 5 s | 60 / 10 | 500 ms | sudden demand | short latency spike, recovery? |
| Endurance | 10 | 30 s | 700 | 500 ms | [FILL or "Not executed"] | stable |

Actual configuration used (copy the `jmeter ...` command from your terminal): [FILL]

## 7. Functional validation and assertion results
| Request | Method | Assertions | Result | Notes |
|---|---|---|---|---|
| Login | POST | code 200; success=true; accessToken exists; email = CSV user | [FILL] | |
| Negative login | POST | 401; error = INVALID_CREDENTIALS | [FILL] | |
| Get Profile | GET | code 200; userId; name pattern; status = ACTIVE | [FILL] | |
| Update Profile | PUT | code 200; phone updated | [FILL] | |
| Get Account Balance | GET | code 200; accountId; currency NGN; balance exists | [FILL] | |
| Get Transaction History | GET | code 200; accountId; items exist | [FILL] | |
| Initiate Transfer | POST | code 201; status PENDING; amount; fromAccount | [FILL] | |
| Get Transfer Status | GET | transferId; status PENDING/COMPLETED | [FILL] | |
| Add / Delete Beneficiary | POST / DELETE | 201 / deleted = true | [FILL] | |

**Negative assertion exercise:** status assertion set to `INACTIVE` (`-JexpectedStatus=INACTIVE`). Observed: [FILL: failure message]. Restored to `ACTIVE`; re-run result: [FILL].

**Extraction:** `accessToken`, `userId`, `accountId`, `transferId`, `beneficiaryId` extracted and reused (evidence: Debug Sampler, Authorization header screenshot). Failed-extraction demo (`missingValue`): value = [FILL: NOT_FOUND]. A default value does not fail the sampler because an extractor only sets variables; protection is the `accessToken` exists assertion plus the `If` controller that skips dependent requests.

**Data-driven evidence:** [FILL: users observed per thread, e.g. thread 1 -> user01]. Data exhaustion (`recycle=false`, 5 threads, 3 rows): [FILL: observed threads stopped].

## 8. Performance metrics and charts
Source: JMeter Aggregate Report and HTML dashboards in `reports/html/` (cross-checked with `scripts/summarize-jtl.js`).

| Metric | Baseline | Load | Stress | Spike | Endurance |
|---|---|---|---|---|---|
| Total requests/samples | [FILL] | [FILL] | [FILL] | [FILL] | [FILL] |
| Average response time (ms) | | | | | |
| Median response time (ms) | | | | | |
| 90th percentile (ms) | | | | | |
| 95th percentile (ms) | | | | | |
| 99th percentile (ms) | | | | | |
| Throughput (req/s) | | | | | |
| Error percentage | | | | | |
| Slowest endpoint | | | | | |
| Most error-prone endpoint | | | | | |

Charts to include (from the HTML dashboard): response time over time, active threads over time, throughput over time, response-time percentiles. [FILL: insert images]

### Questions
**Why can average response time be misleading?** The mean is dragged by outliers and hides distribution: a few very slow requests can be averaged away, and a fast majority can mask a slow minority. Two tests with the same average can feel completely different to users. Median and percentiles show what typical and worst-case users experience.

**What does the 95th percentile tell you?** 95 % of requests completed at or below this time and 5 % were slower. It captures tail latency without being dominated by a single extreme outlier, which makes it a common basis for service-level targets.

**Throughput vs concurrent users:** concurrent users (threads) is the *load applied*; throughput is the *work completed per unit time* (requests/s). With fixed users, longer response times or longer think time *lower* throughput. Throughput can plateau or fall while users keep increasing, which signals saturation.

**Investigating an endpoint whose response time rises sharply under load:** (1) confirm it in per-endpoint percentiles and over-time graphs; find the load level where it starts; (2) check whether errors/timeouts co-occur; (3) rule out the load generator (CPU/memory of the JMeter machine); (4) correlate with server-side metrics - CPU, memory, GC, thread/connection pools, DB query times and locks; (5) review logs/traces for that endpoint; (6) form a hypothesis, change one variable, re-test. Without server-side evidence the cause remains a hypothesis.

**Can a test be successful if every request returns HTTP 200 but performance targets are missed?** No. Status 200 shows only that the server answered; it says nothing about correctness of the body (hence JSON assertions) or about speed. If AC-2 is missed, the performance criterion **fails** even with a 100 % success rate.

## 9. Errors and suspected bottlenecks
| Observation | Evidence | Status |
|---|---|---|
| [FILL: e.g. 503 errors began at ~N active threads] | [FILL: JTL / dashboard reference] | Confirmed (observed) |
| [FILL: suspected cause] | none server-side | **Hypothesis** - needs CPU/memory/DB evidence |

Did errors increase with load? [FILL per scenario]. Did response time change significantly? [FILL]. Note: in this mock, degradation is *simulated* from in-flight request count, so identified "capacity limits" are properties of the mock configuration.

## 10. Concurrency test findings
**Design:** 2 users, Synchronizing Timer, withdraw 800 from balance 1000; also 2 submissions with one `Idempotency-Key`. Independent verification via the admin ledger endpoint.

| Check | Unsafe mode | Safe mode |
|---|---|---|
| Withdraw responses | [FILL: e.g. 200 / 200] | [FILL: e.g. 200 / 422] |
| Debit entries in ledger (expected 1) | [FILL] | [FILL] |
| Ledger debit total (expected 800) | [FILL] | [FILL] |
| Final balance (expected 200) | [FILL] | [FILL] |
| Duplicate processing on retry (expected none) | [FILL] | [FILL] |

Interpretation: [FILL - e.g. unsafe mode allowed both withdrawals (overdraft / lost update); the balance alone looked plausible, the ledger revealed the double debit].
Limitation: two requests sent close together are not guaranteed to be processed at the same instant (thread scheduling, network/connection handling, server event loop, OS scheduler). The Synchronizing Timer raises the chance of overlap but cannot guarantee it; repeat runs ([FILL: N runs]) to show consistency.

## 11. Recommendations and limitations
**Recommendations (draft - keep only those your evidence supports):**
1. Make balance checks and debits atomic (database transaction with row lock or optimistic version check); add a concurrency regression test to CI.
2. Require idempotency keys for transfer creation and keep the replay behaviour tested.
3. Define formal SLAs (p95, error rate, peak concurrency) with the product team before release; this report used assumed values.
4. Repeat tests on a production-like environment with a separate load generator and server-side monitoring.
5. Investigate the endpoint(s) that degrade first: [FILL].

**Limitations:** mock API with simulated degradation; same-machine load generation; no server-side metrics; assumed acceptance criteria; short duration [FILL]; single machine and run count; percentile method differences between tools.

## 12. Command-line execution and reporting
Command used: [FILL: paste exact `jmeter -n -t ... -l ... -e -o ...`]. `-n` runs without the GUI, `-t` selects the plan, `-l` writes raw results, `-e -o` generate the HTML dashboard into a clean folder. Output directory cleaned before each run: [Yes/No]. JMeter exit code: [FILL]. **A zero exit code only means the process finished;** it does not prove assertions or SLAs passed, because failed assertions and slow responses are recorded in the JTL rather than changing the exit code.

## 13. Final conclusion
| Criterion | Verdict | Evidence |
|---|---|---|
| AC-1 Functional assertions | [PASS / FAIL / INCONCLUSIVE] | [FILL] |
| AC-2 p95 <= 500 ms | [..] | [FILL: measured value, scenario] |
| AC-3 Error rate <= 1 % | [..] | [FILL] |
| AC-4 No degradation over time | [..] / Not executed | [FILL] |
| AC-5 Concurrency safety | [..] | [FILL] |

**Release recommendation:** [FILL: e.g. Do not release until the unsafe withdrawal path is fixed; performance within criteria up to N users on this mock.]

**Confirmed findings** (directly observed in results): [FILL]
**Hypotheses** (need further evidence): [FILL]
