# TestJedi JMeter Assignment - Fintech API Performance & Functional Testing

Apache JMeter test suite for a **local mock digital-banking API**. It covers functional API testing, JSON extraction/assertion, data-driven login, load/stress/spike/endurance testing, a race-condition test, and non-GUI execution with HTML reporting.

> **Authorisation:** all testing targets `http://127.0.0.1:3000`, a mock server written for this exercise and run on the tester's own machine. No public or production system is touched. All data is fictional.

---

## 1. Folder contents

```
TestJedi-JMeter-Assignment/
├── TestJedi_Fintech_Performance_Test.jmx   main plan (functional + baseline/load/stress/spike/endurance)
├── TestJedi_Concurrency_Test.jmx           race-condition + duplicate-submission plan (Part H)
├── test-users.csv                          3 fictional sandbox users (Part E)
├── README.md
├── mock-api/server.js                      the API under test (Node, zero dependencies)
├── scripts/
│   ├── run-tests.js                        runs a scenario in non-GUI mode, cleans old output, summarises
│   ├── summarize-jtl.js                    turns a .jtl into the Part G metrics table (+ optional pass/fail)
│   └── generate-jmx.py                     regenerates both .jmx files (optional)
├── results/                                .jtl + *-summary.md   (created when you run tests)
├── reports/
│   ├── html/<scenario>/                    JMeter HTML dashboards
│   └── performance-test-report-TEMPLATE.md fill in -> export to performance-test-report.pdf
└── screenshots/                            your evidence (see section 7)
```

## 2. Environment and setup

| Item | Version used / required |
|---|---|
| Apache JMeter | 5.6.x (plans were written for 5.6.3) |
| Java | 17 or newer (JMeter requirement) |
| Node.js | 16 or newer (mock API and helper scripts) |
| Python 3 | optional, only to regenerate the .jmx |

1. Install Java and JMeter; make sure `jmeter -v` works (or set `JMETER_HOME`).
2. Start the mock API in its own terminal and leave it running:
   ```bash
   node mock-api/server.js        # http://127.0.0.1:3000
   ```
   (`scripts/run-tests.js` will also start it for you if it is not running.)
3. Check it: `curl http://127.0.0.1:3000/health`

### Mock API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | returns `data.accessToken`, `data.user.{id,email,accountId}` |
| GET | `/api/users/{id}/profile` | customer profile |
| PUT | `/api/users/{id}/profile` | update `name` / `phone` |
| GET | `/api/accounts/{id}/balance` | balance |
| GET | `/api/accounts/{id}/transactions?limit=N` | history |
| POST | `/api/transfers` | initiate transfer (honours `Idempotency-Key`) |
| GET | `/api/transfers/{id}` | transfer status (`PENDING` -> `COMPLETED`) |
| POST / DELETE | `/api/beneficiaries`, `/api/beneficiaries/{id}` | create / delete a test resource |
| POST | `/api/accounts/{id}/withdraw?mode=unsafe\|safe` | **concurrency target** |
| GET/POST | `/api/admin/state`, `/api/admin/reset`, `/api/admin/set-balance` | out-of-band verification and reset (test-only) |

Every endpoint except login and `/api/admin/*` requires `Authorization: Bearer <token>`.
Endpoints that do not exist (e.g. PATCH) have no requests in the plan.

## 3. How the test plan is built (Part A / B / C / D / E)

```
Test Plan: TestJedi_Fintech_Performance_Test
├── User Defined Variables      host/port/protocol (overridable with -J), destAccount, transferAmount, expectedStatus
├── HTTP Request Defaults       ${protocol}://${host}:${port}
├── CSV Data Set Config         test-users.csv -> ${username}, ${password}
├── Thread Group "Main Workload"          threads/ramp-up/loops come from -J properties
│   ├── HTTP Header Manager (JSON)        Content-Type, Accept
│   ├── Constant Timer                    think time (-JthinkTime, default 200 ms)
│   ├── Login (POST)                      Response + 3 JSON Assertions; JSON Extractors: accessToken, userId, accountId
│   │                                     (+ a deliberate "bad path" extractor -> missingValue = NOT_FOUND)
│   ├── If debug=true  -> Debug Sampler   shows extracted variables
│   ├── If negativeTests=true -> Negative login (expects 401)
│   └── If token extracted (accessToken != NOT_FOUND)
│       ├── HTTP Header Manager           Authorization: Bearer ${accessToken}
│       ├── Get Profile (GET)             JSON Assertions incl. status = ${expectedStatus}
│       ├── Update Profile (PUT)
│       ├── Get Account Balance (GET)
│       ├── Get Transaction History (GET ?limit=5)
│       ├── Transaction Controller "Transfer Flow"
│       │   ├── Initiate Transfer (POST, Idempotency-Key = ${__UUID})
│       │   └── Get Transfer Status (GET ${transferId})
│       ├── Add Beneficiary (POST)        extracts ${beneficiaryId}
│       └── Delete Beneficiary (DELETE)
├── Thread Group "Spike Burst"            0 threads unless -JspikeThreads is set (same workflow)
└── Listeners: View Results Tree (disabled), Aggregate Report, Summary Report
```

### Thread Group settings (Task 2)

Defaults give the required initial functional test: **1 thread, 1 s ramp-up, 1 loop.**

| Setting | Meaning | Effect of changing it |
|---|---|---|
| Number of Threads | Virtual users running concurrently | More threads -> more simultaneous requests -> higher throughput until the server saturates, then higher latency / errors |
| Ramp-up Period | Seconds JMeter takes to start *all* threads (threads start at `ramp-up / threads` intervals) | Short ramp-up = sudden load (spike); long ramp-up = gradual build-up (stress); 1 s with 1 thread is effectively "start now" |
| Loop Count | Times each thread runs the whole workflow | Total workflow runs = threads x loops; sets test length together with think time |

JMeter is configured with `-J` properties (`-Jthreads=10 -JrampUp=60 -Jloops=70`), so one plan serves every scenario.

### Extraction and failure handling (Part C, Task 4)

* **Default value used:** if a JSONPath matches nothing, the variable is set to the literal default - here `NOT_FOUND` (see `missingValue` in the Debug Sampler).
* **Detecting it:** Debug Sampler / View Results Tree variable list; a `JSON Assertion - accessToken exists` on Login (fails the sampler if the path is absent); and the `If` controller condition.
* **Why the default alone doesn't fail the sampler:** a JSON Extractor is a *post-processor*, not an assertion. It only sets variables. A sampler fails only when the HTTP result is an error or an *assertion* fails. A `200 OK` with a missing token is a successful sample as far as the extractor is concerned.
* **Preventing a dependent request from using a bad token:** (1) the assertion above, and (2) the `If` controller `"${accessToken}" != "NOT_FOUND"` which **skips** every dependent request instead of sending `Bearer NOT_FOUND`.

### Assertions vs extractors (Part D, Task 3)

| Element | What it does | Practical use here |
|---|---|---|
| JSON Extractor | Pulls a value out of a JSON response into a variable | Capture `accessToken` to build `Authorization: Bearer ${accessToken}` |
| JSON Assertion | Checks a JSONPath exists and (optionally) equals an expected value / regex | Confirm `$.data.status == ACTIVE` - the body is correct, not just the status code |
| Response Assertion | Checks the raw response (code, text, headers) | Confirm the transfer returned HTTP `201`, or that a bad login returned `401` |

**Negative scenario:** run `node scripts/run-tests.js negative-assertion` (or GUI with `-JexpectedStatus=INACTIVE`) - the *Get Profile* status assertion must fail. Nothing in the plan is edited, so "restoring" is simply running again without that property.

### Data-driven testing (Part E)

* `CSV Data Set Config` reads `test-users.csv` (header skipped, variables `username,password`) and feeds the Login body `{"username":"${username}","password":"${password}"}`.
* **Sharing mode = "All threads"**: one shared file pointer, so each request iteration - across every thread - takes the *next* row. Thread 1 gets user01, thread 2 user02, thread 3 user03. With *"Current thread"* each thread would instead read the whole file independently from the top (every thread would start as user01) - useful when each user needs its own full data set, wrong here because we want distinct identities.
* **Data exhausted:** the plan defaults to `recycle=true` (wrap to row 1) so 10+ threads can run on 3 rows. To demonstrate exhaustion run the `data-exhaustion` scenario (`-JcsvRecycle=false -JcsvStopThread=true`): 5 threads, 3 rows -> threads 4 and 5 stop cleanly rather than send `<EOF>` as a username.
* **Secrets:** credentials are the fictional ones the mock accepts. Tokens are random per login and not stored in files. `results/*.jtl` does not save request/response bodies (`responseData`/`samplerData` off), so tokens and passwords are not written to the results. In any screenshot of a *Debug Sampler* or *View Results Tree*, blur the token. The `.gitignore.sample` file lists what not to commit.

## 4. Running the tests

### Functional run in the GUI (for screenshots)
```bash
jmeter -t TestJedi_Fintech_Performance_Test.jmx
```
Enable **View Results Tree** (right-click -> Enable), press Start, take screenshots (section 7). Do **not** keep it enabled for load tests.

### Scenarios in non-GUI mode (recommended)
```bash
node scripts/run-tests.js functional
node scripts/run-tests.js negative-assertion data-exhaustion
node scripts/run-tests.js baseline load stress spike
node scripts/run-tests.js concurrency-unsafe concurrency-safe
node scripts/run-tests.js endurance           # ~30 min, optional, not part of "all"
node scripts/run-tests.js baseline --dry-run  # print the JMeter command only
```

| Scenario | Configuration | Objective |
|---|---|---|
| baseline | 1 thread, 10 loops, 200 ms think | normal performance with no contention |
| load | 10 threads, 60 s ramp-up, 70 loops, 500 ms think (~5 min at full load) | expected workload |
| stress | up to 300 threads, 300 s ramp-up, 30 loops | find where latency degrades / errors begin |
| spike | 5 steady threads; after 60 s, 200 more ramp up in 5 s | behaviour under sudden demand |
| endurance | 10 threads, 700 loops, 500 ms think (~30 min) | detect gradual degradation (e.g. memory growth) |

**Acceptance criteria used for verdicts** (change them to what your instructor defines, then re-run the summariser): `p95 <= 500 ms` and `error rate <= 1 %`. These are *assumed* thresholds for this exercise because the assignment supplies none; the report must say so.

### The raw command (Part I)
```bash
rm -rf reports/html/load-test results/load-test.jtl      # must be clean before every run
jmeter -n -t TestJedi_Fintech_Performance_Test.jmx \
       -l results/load-test.jtl -e -o reports/html/load-test \
       -Jthreads=10 -JrampUp=60 -Jloops=70 -JthinkTime=500 -Jdebug=false -JnegativeTests=false
```
| Flag | Meaning |
|---|---|
| `-n` | non-GUI mode |
| `-t` | test plan to run |
| `-l` | write raw sample results (JTL/CSV) here; JMeter **appends** if it exists, so delete old files first |
| `-e` | generate the HTML dashboard when the test finishes |
| `-o` | dashboard output folder; must be empty or non-existent |
| `-J name=value` | sets a JMeter property read by `${__P(name,default)}` in the plan |

**Why exit code 0 does not mean the test passed:** the exit code reports whether the JMeter *process* ran to completion. Failed assertions, 5xx responses, and blown response-time targets are just data in the JTL; JMeter still exits 0. Pass/fail must be decided by comparing results to defined criteria (what `summarize-jtl.js --criteria` and the report do).

### Summarise any result file
```bash
node scripts/summarize-jtl.js results/load-test.jtl --criteria "p95<=500,errorPct<=1" --out results/load-test-summary.md
```

## 5. Concurrency test (Part H)

`TestJedi_Concurrency_Test.jmx` (thread groups run one after another):

1. **setUp** - reset mock state; set `ACC-RACE` balance to 1000.
2. **TG1** - 2 virtual users each log in, wait at a **Synchronizing Timer**, then withdraw 800 at the same moment. Only one withdrawal can legitimately succeed.
3. **TG2** - 2 virtual users submit the *same* transfer with the *same* `Idempotency-Key` (a client retry); the debit must be applied once.
4. **tearDown** - reads the ledger through the admin endpoint (**independent of the withdraw responses**) and asserts: exactly 1 debit entry, ledger debits = 800, balance = 200, and 1 debit for the retried transfer.

`mode=unsafe` has a deliberate check-then-act bug, so the verification assertions are expected to **fail** (two 200 responses, two ledger debits totalling 1600 from a 1000 balance - a lost update/overdraft). `mode=safe` serialises withdrawals and is expected to pass. Note that in the unsafe case the final *balance* can still equal 200 - the ledger exposes the problem, which is why the balance alone is not enough verification.

**Why "two requests close together" is not "simultaneous":** the Synchronizing Timer releases both threads together, but each still needs its own thread scheduling, TCP/connection handling, network stack and server event-loop turn; the server may process them microseconds or milliseconds apart, and the OS scheduler decides the order. The test therefore *raises the probability* of overlap; the mock's artificial 40 ms read-to-write gap makes the overlap reliable. Run it several times - a real system's race may appear only intermittently, so a single clean run proves nothing.

## 6. Assumptions and limitations

* The target is a **mock**. Latency, degradation and 503 behaviour are *simulated* from the number of in-flight requests (see header of `mock-api/server.js`); results describe this mock, not a real banking backend, and cannot identify real bottlenecks (database, network, CPU).
* The mock and JMeter run on the **same machine**, so they compete for CPU and the generator itself may become the bottleneck at high thread counts. A real test would use a separate load generator.
* Mock state is in memory and reset between scenarios; `destAccount` is `ACC-1003` for every user, so user03's transfers are to itself.
* Throughput, percentile and response-time figures depend on the machine; treat absolute values as indicative only.
* Acceptance thresholds (`p95 <= 500 ms`, `error rate <= 1 %`) are assumed, not provided.
* A Transaction Controller (`parent=false`) writes an extra "Transfer Flow" sample, so JMeter totals include it; `summarize-jtl.js --exclude-transactions` removes it.
* Spike group users share sampler labels with the main group; separate them in the JTL by `threadName` ("Spike Burst ...").
* The Spike Burst thread group uses `0` threads by default so it is inert unless `-JspikeThreads` is set.
* Percentiles from `summarize-jtl.js` use nearest-rank and may differ slightly from the JMeter dashboard; quote the dashboard in your report.
* Server-side evidence (CPU, memory, GC) is not collected, so any statement about *why* latency rose is a **hypothesis**, not a confirmed finding.

## 7. Evidence checklist (screenshots/)

| File | What to capture |
|---|---|
| `test-plan.png` | Test Plan tree expanded |
| `thread-group.png` | Main Workload settings: 1 / 1 / 1 |
| `json-extractor.png` | Login extractor: `accessToken`, `$.data.accessToken`, match 1, default `NOT_FOUND` |
| `json-assertion.png` | at least two JSON Assertions (path + expected value) |
| `passing-assertion.png` | View Results Tree, green samples + assertion tab |
| `failing-assertion.png` | `negative-assertion` run: red *Get Profile* with the failure message |
| `aggregate-report.png` | Aggregate Report after a GUI run |
| (extra, recommended) | Debug Sampler variables; Authorization header in a request; CSV Data Set Config; one request per method (GET/POST/PUT/DELETE); HTML dashboard summary |

Hide tokens before saving screenshots.

## 8. First-run checks and troubleshooting

These plans were generated and structure-checked (well-formed XML, every element paired with its child tree) and the mock API and concurrency logic were exercised with scripted requests, but the `.jmx` files were **authored without a JMeter installation available**, so open them once in the GUI before relying on them:

1. Open `TestJedi_Fintech_Performance_Test.jmx` - it should load with no errors, and the tree should match section 3.
2. Run the `functional` scenario first. Expected: every sample green. If an assertion is red, read its failure message in View Results Tree; the most likely cause is a JSONPath/expected-value difference you can fix in the GUI.
3. If JMeter complains about the **Spike Burst** group having 0 threads, right-click it -> *Disable* for baseline/load/stress runs and *Enable* it for the spike run with `-JspikeThreads=200`.
4. If `csv` data is not found, run JMeter from the project folder or set `-JcsvFile=/full/path/test-users.csv`.
5. `Connection refused` in samples means the mock API is not running (`node mock-api/server.js`).
