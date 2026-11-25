#!/usr/bin/env python3
"""
Generates the JMeter test plans for the TestJedi assignment.

    python3 scripts/generate-jmx.py

Outputs (next to the repo root):
    TestJedi_Fintech_Performance_Test.jmx   main functional + performance plan
    TestJedi_Concurrency_Test.jmx           race-condition / idempotency plan

The plans are plain JMeter 5.6.x XML. You can open and edit them in the GUI;
this script only exists so the XML is consistent and reproducible.
"""
import os
import zlib
from xml.dom import minidom
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JMETER_VERSION = "5.6.3"


# ---------------------------------------------------------------- helpers ---
def s(name, value):  # stringProp
    return f'<stringProp name="{name}">{escape(str(value))}</stringProp>'


def b(name, value):  # boolProp
    return f'<boolProp name="{name}">{"true" if value else "false"}</boolProp>'


def node(xml, children=""):
    """An element followed by its hashTree."""
    return f"{xml}\n<hashTree>\n{children}\n</hashTree>\n"


def attr(v):
    return escape(str(v), {'"': "&quot;"})


# --------------------------------------------------------- config elements ---
def udv(name, pairs, comment=""):
    rows = "".join(
        f'<elementProp name="{attr(k)}" elementType="Argument">'
        f'{s("Argument.name", k)}{s("Argument.value", v)}{s("Argument.metadata", "=")}'
        f"</elementProp>"
        for k, v in pairs
    )
    return node(
        f'<Arguments guiclass="ArgumentsPanel" testclass="Arguments" testname="{attr(name)}" enabled="true">'
        f'{s("TestPlan.comments", comment)}<collectionProp name="Arguments.arguments">{rows}</collectionProp></Arguments>'
    )


def http_defaults():
    return node(
        '<ConfigTestElement guiclass="HttpDefaultsGui" testclass="ConfigTestElement" testname="HTTP Request Defaults" enabled="true">'
        '<elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">'
        '<collectionProp name="Arguments.arguments"/></elementProp>'
        + s("HTTPSampler.domain", "${host}")
        + s("HTTPSampler.port", "${port}")
        + s("HTTPSampler.protocol", "${protocol}")
        + s("HTTPSampler.contentEncoding", "UTF-8")
        + s("HTTPSampler.path", "")
        + s("HTTPSampler.connect_timeout", "5000")
        + s("HTTPSampler.response_timeout", "15000")
        + "</ConfigTestElement>"
    )


def csv_config():
    return node(
        '<CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="CSV Data Set Config - test-users.csv" enabled="true">'
        + s("TestPlan.comments", "Each iteration reads the next row. All threads share one file pointer (shareMode.all), so different virtual users get different identities. Override end-of-file behaviour with -JcsvRecycle / -JcsvStopThread.")
        + s("delimiter", ",")
        + s("fileEncoding", "UTF-8")
        + s("filename", "${__P(csvFile,test-users.csv)}")
        + b("ignoreFirstLine", True)
        + b("quotedData", False)
        + s("recycle", "${__P(csvRecycle,true)}")
        + s("shareMode", "shareMode.all")
        + s("stopThread", "${__P(csvStopThread,false)}")
        + s("variableNames", "username,password")
        + "</CSVDataSet>"
    )


def header_manager(name, headers, comment=""):
    rows = "".join(
        f'<elementProp name="" elementType="Header">{s("Header.name", k)}{s("Header.value", v)}</elementProp>'
        for k, v in headers
    )
    return node(
        f'<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="{attr(name)}" enabled="true">'
        f'{s("TestPlan.comments", comment)}<collectionProp name="HeaderManager.headers">{rows}</collectionProp></HeaderManager>'
    )


def constant_timer(name="Think Time (Constant Timer)"):
    return node(
        f'<ConstantTimer guiclass="ConstantTimerGui" testclass="ConstantTimer" testname="{name}" enabled="true">'
        + s("ConstantTimer.delay", "${__P(thinkTime,200)}")
        + "</ConstantTimer>"
    )


def sync_timer(group_size="${__P(racers,2)}", timeout=10000):
    return node(
        '<SyncTimer guiclass="TestBeanGUI" testclass="SyncTimer" testname="Synchronizing Timer (release racers together)" enabled="true">'
        + s("groupSize", group_size)
        + f'<longProp name="timeoutInMs">{timeout}</longProp></SyncTimer>'
    )


# ----------------------------------------------------------------- samplers ---
def http(name, method, path, body=None, children="", comment="", enabled=True):
    if body is not None:
        args = (
            '<elementProp name="HTTPsampler.Arguments" elementType="Arguments">'
            '<collectionProp name="Arguments.arguments"><elementProp name="" elementType="HTTPArgument">'
            + b("HTTPArgument.always_encode", False)
            + s("Argument.value", body)
            + s("Argument.metadata", "=")
            + "</elementProp></collectionProp></elementProp>"
        )
        raw = b("HTTPSampler.postBodyRaw", True)
    else:
        args = (
            '<elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">'
            '<collectionProp name="Arguments.arguments"/></elementProp>'
        )
        raw = ""
    xml = (
        f'<HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="{attr(name)}" enabled="{"true" if enabled else "false"}">'
        + s("TestPlan.comments", comment)
        + raw
        + args
        + s("HTTPSampler.path", path)
        + s("HTTPSampler.method", method)
        + b("HTTPSampler.follow_redirects", True)
        + b("HTTPSampler.auto_redirects", False)
        + b("HTTPSampler.use_keepalive", True)
        + b("HTTPSampler.DO_MULTIPART_POST", False)
        + s("HTTPSampler.embedded_url_re", "")
        + "</HTTPSamplerProxy>"
    )
    return node(xml, children)


def debug_sampler(name="Debug Sampler - extracted variables"):
    return node(
        f'<DebugSampler guiclass="TestBeanGUI" testclass="DebugSampler" testname="{name}" enabled="true">'
        + b("displayJMeterProperties", False)
        + b("displayJMeterVariables", True)
        + b("displaySystemProperties", False)
        + "</DebugSampler>"
    )


# ------------------------------------------------- assertions / extractors ---
def json_assert(name, path, expected=None, regex=False, invert=False):
    """expected=None -> only checks that the JSONPath exists. Otherwise checks the VALUE."""
    validate = expected is not None
    return node(
        f'<JSONPathAssertion guiclass="JSONPathAssertionGui" testclass="JSONPathAssertion" testname="{attr(name)}" enabled="true">'
        + s("JSON_PATH", path)
        + s("EXPECTED_VALUE", "" if expected is None else expected)
        + b("JSONVALIDATION", validate)
        + b("EXPECT_NULL", False)
        + b("INVERT", invert)
        + b("ISREGEX", regex)
        + "</JSONPathAssertion>"
    )


def code_assert(name, code, regex=False, ignore_status=False):
    """Response Assertion on the HTTP response code. 'Equals' (8) or 'Matches' regex (1)."""
    test_type = 1 if regex else 8
    return node(
        f'<ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="{attr(name)}" enabled="true">'
        f'<collectionProp name="Asserion.test_strings"><stringProp name="{zlib.crc32(code.encode()) % 100000}">{escape(code)}</stringProp></collectionProp>'
        + s("Assertion.custom_message", "")
        + s("Assertion.test_field", "Assertion.response_code")
        + b("Assertion.assume_success", ignore_status)
        + f'<intProp name="Assertion.test_type">{test_type}</intProp>'
        + "</ResponseAssertion>"
    )


def json_extract(name, var, path, default="NOT_FOUND", match="1"):
    return node(
        f'<JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="{attr(name)}" enabled="true">'
        + s("JSONPostProcessor.referenceNames", var)
        + s("JSONPostProcessor.jsonPathExprs", path)
        + s("JSONPostProcessor.match_numbers", match)
        + s("JSONPostProcessor.defaultValues", default)
        + "</JSONPostProcessor>"
    )


# -------------------------------------------------------------- controllers ---
def if_controller(name, condition, children, comment=""):
    return node(
        f'<IfController guiclass="IfControllerPanel" testclass="IfController" testname="{attr(name)}" enabled="true">'
        + s("TestPlan.comments", comment)
        + s("IfController.condition", condition)
        + b("IfController.evaluateAll", False)
        + b("IfController.useExpression", True)
        + "</IfController>",
        children,
    )


def transaction_controller(name, children):
    return node(
        f'<TransactionController guiclass="TransactionControllerGui" testclass="TransactionController" testname="{attr(name)}" enabled="true">'
        + b("TransactionController.includeTimers", False)
        + b("TransactionController.parent", False)
        + "</TransactionController>",
        children,
    )


def thread_group(name, threads, ramp, loops, children, scheduler=False, delay="", duration="", comment=""):
    return node(
        f'<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="{attr(name)}" enabled="true">'
        + s("TestPlan.comments", comment)
        + s("ThreadGroup.on_sample_error", "continue")
        + '<elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">'
        + b("LoopController.continue_forever", False)
        + s("LoopController.loops", loops)
        + "</elementProp>"
        + s("ThreadGroup.num_threads", threads)
        + s("ThreadGroup.ramp_time", ramp)
        + b("ThreadGroup.scheduler", scheduler)
        + s("ThreadGroup.duration", duration)
        + s("ThreadGroup.delay", delay)
        + b("ThreadGroup.same_user_on_next_iteration", True)
        + "</ThreadGroup>",
        children,
    )


def special_thread_group(kind, name, children):
    """setUp / tearDown thread groups."""
    cls = {"setUp": "SetupThreadGroup", "tearDown": "PostThreadGroup"}[kind]
    gui = {"setUp": "SetupThreadGroupGui", "tearDown": "PostThreadGroupGui"}[kind]
    return node(
        f'<{cls} guiclass="{gui}" testclass="{cls}" testname="{attr(name)}" enabled="true">'
        + s("ThreadGroup.on_sample_error", "continue")
        + '<elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">'
        + b("LoopController.continue_forever", False)
        + s("LoopController.loops", "1")
        + "</elementProp>"
        + s("ThreadGroup.num_threads", "1")
        + s("ThreadGroup.ramp_time", "1")
        + b("ThreadGroup.scheduler", False)
        + s("ThreadGroup.duration", "")
        + s("ThreadGroup.delay", "")
        + b("ThreadGroup.same_user_on_next_iteration", True)
        + f"</{cls}>",
        children,
    )


# ---------------------------------------------------------------- listeners ---
_SAVE = (
    "<time>true</time><latency>true</latency><timestamp>true</timestamp><success>true</success><label>true</label>"
    "<code>true</code><message>true</message><threadName>true</threadName><dataType>true</dataType><encoding>false</encoding>"
    "<assertions>true</assertions><subresults>true</subresults><responseData>false</responseData><samplerData>false</samplerData>"
    "<xml>false</xml><fieldNames>true</fieldNames><responseHeaders>false</responseHeaders><requestHeaders>false</requestHeaders>"
    "<responseDataOnError>false</responseDataOnError><saveAssertionResultsFailureMessage>true</saveAssertionResultsFailureMessage>"
    "<assertionsResultsToSave>0</assertionsResultsToSave><bytes>true</bytes><sentBytes>true</sentBytes><url>true</url>"
    "<threadCounts>true</threadCounts><idleTime>true</idleTime><connectTime>true</connectTime>"
)


def listener(name, gui, enabled=True, comment=""):
    return node(
        f'<ResultCollector guiclass="{gui}" testclass="ResultCollector" testname="{attr(name)}" enabled="{"true" if enabled else "false"}">'
        + s("TestPlan.comments", comment)
        + b("ResultCollector.error_logging", False)
        + f'<objProp><name>saveConfig</name><value class="SampleSaveConfiguration">{_SAVE}</value></objProp>'
        + s("filename", "")
        + "</ResultCollector>"
    )


def test_plan(name, comment, body, serialize=False):
    xml = (
        f'<?xml version="1.0" encoding="UTF-8"?>\n<jmeterTestPlan version="1.2" properties="5.0" jmeter="{JMETER_VERSION}">\n<hashTree>\n'
        f'<TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="{attr(name)}" enabled="true">'
        + s("TestPlan.comments", comment)
        + b("TestPlan.functional_mode", False)
        + b("TestPlan.tearDown_on_shutdown", True)
        + b("TestPlan.serialize_threadgroups", serialize)
        + '<elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">'
        '<collectionProp name="Arguments.arguments"/></elementProp>'
        + s("TestPlan.user_define_classpath", "")
        + f"</TestPlan>\n<hashTree>\n{body}\n</hashTree>\n</hashTree>\n</jmeterTestPlan>\n"
    )
    return xml


def xml_dom(text):
    """Well-formedness check only; the original text is kept (pretty-printing would alter bodies)."""
    minidom.parseString(text.encode("utf-8"))
    return text


# =========================================================== MAIN TEST PLAN ===
def workflow():
    """The user journey shared by the main and spike thread groups."""
    login = http(
        "Login",
        "POST",
        "/api/auth/login",
        body='{"username":"${username}","password":"${password}"}',
        comment="POST with JSON body. Credentials come from the CSV Data Set Config.",
        children=(
            code_assert("Response Code = 200", "200")
            + json_assert("JSON Assertion - success is true", "$.success", "true")
            + json_assert("JSON Assertion - accessToken exists", "$.data.accessToken")
            + json_assert("JSON Assertion - email matches CSV user", "$.data.user.email", "${username}")
            + json_extract("JSON Extractor - accessToken", "accessToken", "$.data.accessToken")
            + json_extract("JSON Extractor - userId", "userId", "$.data.user.id")
            + json_extract("JSON Extractor - accountId", "accountId", "$.data.user.accountId")
            + json_extract(
                "JSON Extractor - DEMO bad path (expected to miss)",
                "missingValue",
                "$.data.doesNotExist",
            )
        ),
    )
    debug = if_controller(
        "If debug=true",
        '${__jexl3("${__P(debug,true)}" == "true")}',
        debug_sampler(),
        comment="Shows accessToken, userId, accountId and missingValue (=NOT_FOUND) in View Results Tree. Disable for load runs with -Jdebug=false.",
    )
    negative = if_controller(
        "If negativeTests=true",
        '${__jexl3("${__P(negativeTests,true)}" == "true")}',
        http(
            "Negative - Login with wrong password (expects 401)",
            "POST",
            "/api/auth/login",
            body='{"username":"${username}","password":"WrongPassword-Not-Real"}',
            comment="Response Assertion has 'Ignore Status' on so the expected 401 counts as a pass.",
            children=code_assert("Response Code = 401", "401", ignore_status=True)
            + json_assert("JSON Assertion - error is INVALID_CREDENTIALS", "$.error", "INVALID_CREDENTIALS"),
        ),
        comment="Functional negative check. Switched off for load tests (-JnegativeTests=false) so it does not distort metrics.",
    )

    profile = http(
        "Get Profile",
        "GET",
        "/api/users/${userId}/profile",
        comment="Uses the extracted ${userId}.",
        children=(
            code_assert("Response Code = 200", "200")
            + json_assert("JSON Assertion - success is true", "$.success", "true")
            + json_assert("JSON Assertion - userId matches extracted id", "$.data.userId", "${userId}")
            + json_assert("JSON Assertion - name matches pattern", "$.data.name", "^[A-Za-z]+ Test$", regex=True)
            + json_assert(
                "JSON Assertion - status equals ${expectedStatus}",
                "$.data.status",
                "${__P(expectedStatus,ACTIVE)}",

            )
        ),
        )
    update_profile = http(
        "Update Profile (PUT)",
        "PUT",
        "/api/users/${userId}/profile",
        body='{"phone":"08099999999"}',
        children=code_assert("Response Code = 200", "200")
        + json_assert("JSON Assertion - success is true", "$.success", "true")
        + json_assert("JSON Assertion - phone updated", "$.data.phone", "08099999999"),
    )
    balance = http(
        "Get Account Balance",
        "GET",
        "/api/accounts/${accountId}/balance",
        children=code_assert("Response Code = 200", "200")
        + json_assert("JSON Assertion - success is true", "$.success", "true")
        + json_assert("JSON Assertion - accountId matches", "$.data.accountId", "${accountId}")
        + json_assert("JSON Assertion - currency is NGN", "$.data.currency", "NGN")
        + json_assert("JSON Assertion - balance exists", "$.data.balance"),
    )
    history = http(
        "Get Transaction History",
        "GET",
        "/api/accounts/${accountId}/transactions?limit=5",
        comment="Query parameter limit=5.",
        children=code_assert("Response Code = 200", "200")
        + json_assert("JSON Assertion - success is true", "$.success", "true")
        + json_assert("JSON Assertion - accountId matches", "$.data.accountId", "${accountId}")
        + json_assert("JSON Assertion - items array exists", "$.data.items"),
    )
    transfer = transaction_controller(
        "Transfer Flow (Transaction Controller)",
        http(
            "Initiate Transfer",
            "POST",
            "/api/transfers",
            body='{"fromAccount":"${accountId}","toAccount":"${destAccount}","amount":${transferAmount}}',
            comment="Idempotency-Key header is a fresh UUID per request.",
            children=header_manager("Idempotency-Key Header", [("Idempotency-Key", "${__UUID}")])
            + code_assert("Response Code = 201", "201")
            + json_assert("JSON Assertion - success is true", "$.success", "true")
            + json_assert("JSON Assertion - status is PENDING", "$.data.status", "PENDING")
            + json_assert("JSON Assertion - amount matches", "$.data.amount", "${transferAmount}")
            + json_assert("JSON Assertion - fromAccount matches", "$.data.fromAccount", "${accountId}")
            + json_extract("JSON Extractor - transferId", "transferId", "$.data.transferId"),
        )
        + http(
            "Get Transfer Status",
            "GET",
            "/api/transfers/${transferId}",
            children=code_assert("Response Code = 200", "200")
            + json_assert("JSON Assertion - transferId matches", "$.data.transferId", "${transferId}")
            + json_assert("JSON Assertion - status is PENDING or COMPLETED", "$.data.status", "^(PENDING|COMPLETED)$", regex=True),
        ),
    )
    beneficiary = http(
        "Add Beneficiary (POST)",
        "POST",
        "/api/beneficiaries",
        body='{"name":"Test Payee","accountNumber":"0000000001"}',
        children=code_assert("Response Code = 201", "201")
        + json_assert("JSON Assertion - name echoed", "$.data.name", "Test Payee")
        + json_extract("JSON Extractor - beneficiaryId", "beneficiaryId", "$.data.beneficiaryId"),
    ) + http(
        "Delete Beneficiary (DELETE)",
        "DELETE",
        "/api/beneficiaries/${beneficiaryId}",
        children=code_assert("Response Code = 200", "200")
        + json_assert("JSON Assertion - deleted is true", "$.data.deleted", "true"),
    )

    guarded = if_controller(
        "Proceed only if token extracted",
        '${__jexl3("${accessToken}" != "NOT_FOUND")}',
        header_manager(
            "HTTP Header Manager - Authorization (Bearer token)",
            [("Authorization", "Bearer ${accessToken}")],
            comment="Authorization: Bearer ${accessToken} - the value extracted by the Login request.",
        )
        + profile + update_profile + balance + history + transfer + beneficiary,
        comment="If the extractor fell back to NOT_FOUND, dependent requests are skipped instead of sending an invalid token.",
    )
    return login + debug + negative + guarded


def build_main():
    udv_pairs = [
        ("protocol", "${__P(protocol,http)}"),
        ("host", "${__P(host,127.0.0.1)}"),
        ("port", "${__P(port,3000)}"),
        ("destAccount", "ACC-1003"),
        ("transferAmount", "10"),
        ("expectedStatus", "${__P(expectedStatus,ACTIVE)}"),
    ]
    body = (
        udv("User Defined Variables", udv_pairs, "Override any -J property on the command line, e.g. -Jhost=... -Jport=...")
        + http_defaults()
        + csv_config()
        + thread_group(
            "Main Workload",
            "${__P(threads,1)}",
            "${__P(rampUp,1)}",
            "${__P(loops,1)}",
            header_manager("HTTP Header Manager - JSON", [("Content-Type", "application/json"), ("Accept", "application/json")])
            + constant_timer()
            + workflow(),
            comment="Defaults = initial functional test: 1 thread, 1 s ramp-up, 1 loop. Change with -Jthreads -JrampUp -Jloops.",
        )
        + thread_group(
            "Spike Burst (0 threads unless -JspikeThreads is set)",
            "${__P(spikeThreads,0)}",
            "${__P(spikeRamp,1)}",
            "${__P(spikeLoops,5)}",
            header_manager("HTTP Header Manager - JSON", [("Content-Type", "application/json"), ("Accept", "application/json")])
            + constant_timer()
            + workflow(),
            scheduler=True,
            delay="${__P(spikeDelay,0)}",
            duration="${__P(spikeMaxDuration,3600)}",
            comment="Starts spikeDelay seconds after test start and ramps up to spikeThreads in spikeRamp seconds.",
        )
        + listener("View Results Tree", "ViewResultsFullVisualizer", enabled=False, comment="Enable in the GUI for functional runs and screenshots. Do NOT enable for load tests.")
        + listener("Aggregate Report", "StatVisualizer", comment="Use after a GUI run for the aggregate-report screenshot.")
        + listener("Summary Report", "SummaryReport")
    )
    return test_plan(
        "TestJedi_Fintech_Performance_Test",
        "Functional + performance plan for the TestJedi mock digital-banking API.",
        body,
    )


# ======================================================== CONCURRENCY PLAN ===
def build_concurrency():
    udv_pairs = [
        ("protocol", "${__P(protocol,http)}"),
        ("host", "${__P(host,127.0.0.1)}"),
        ("port", "${__P(port,3000)}"),
        ("mode", "${__P(mode,unsafe)}"),
        ("raceAccount", "ACC-RACE"),
        ("startBalance", "${__P(startBalance,1000)}"),
        ("withdrawAmount", "${__P(withdrawAmount,800)}"),
        ("idemKey", "${__P(idemKey,RETRY-KEY-0001)}"),
        ("expectedWithdrawals", "${__P(expectedWithdrawals,1)}"),
        ("expectedLedgerDebits", "${__P(expectedLedgerDebits,800)}"),
        ("expectedFinalBalance", "${__P(expectedFinalBalance,200)}"),
    ]
    json_hdr = header_manager("HTTP Header Manager - JSON", [("Content-Type", "application/json"), ("Accept", "application/json")])

    setup = special_thread_group(
        "setUp",
        "setUp - reset known state",
        http("Reset mock state", "POST", "/api/admin/reset", body="{}", children=code_assert("Response Code = 200", "200"))
        + http(
            "Set race account balance",
            "POST",
            "/api/admin/set-balance",
            body='{"accountId":"${raceAccount}","balance":${startBalance}}',
            children=code_assert("Response Code = 200", "200")
            + json_assert("JSON Assertion - balance set", "$.data.account.balance", "${startBalance}"),
        ),
    )

    def login(user, pwd):
        return http(
            "Login",
            "POST",
            "/api/auth/login",
            body='{"username":"%s","password":"%s"}' % (user, pwd),
            children=code_assert("Response Code = 200", "200")
            + json_extract("JSON Extractor - accessToken", "accessToken", "$.data.accessToken"),
        )

    race = thread_group(
        "TG1 - Concurrent withdrawals (race)",
        "${__P(racers,2)}",
        "0",
        "1",
        json_hdr
        + login("race@example.test", "RacePassword01")
        + http(
            "Withdraw (synchronised)",
            "POST",
            "/api/accounts/${raceAccount}/withdraw?mode=${mode}",
            body='{"amount":${withdrawAmount}}',
            comment="All racers wait at the Synchronizing Timer, then fire together. Business rule: balance must never go negative / overdraft.",
            children=header_manager("HTTP Header Manager - Authorization", [("Authorization", "Bearer ${accessToken}")])
            + sync_timer()
            + code_assert("Response Code is 200 or 422 (both are legitimate answers)", "^(200|422)$", regex=True)
            + json_extract("JSON Extractor - newBalance (reported by this response)", "newBalance", "$.data.newBalance"),
        ),
        comment="Two (or -Jracers=N) virtual users withdraw 800 from a 1000 balance at the same moment. Only ONE should succeed.",
    )
    retry = thread_group(
        "TG2 - Duplicate submission with the same Idempotency-Key",
        "${__P(racers,2)}",
        "0",
        "1",
        json_hdr
        + login("user01@example.test", "TestPassword01")
        + http(
            "Initiate Transfer (same Idempotency-Key)",
            "POST",
            "/api/transfers",
            body='{"fromAccount":"ACC-1001","toAccount":"ACC-1002","amount":50}',
            comment="Simulates a client retrying the same request. The debit must be applied once.",
            children=header_manager(
                "Headers - Authorization + Idempotency-Key",
                [("Authorization", "Bearer ${accessToken}"), ("Idempotency-Key", "${idemKey}")],
            )
            + sync_timer()
            + code_assert("Response Code is 200 or 201", "^20[01]$", regex=True),
        ),
    )

    verify = special_thread_group(
        "tearDown",
        "tearDown - independent verification of final state",
        http(
            "VERIFY race account (out-of-band admin endpoint)",
            "GET",
            "/api/admin/state?accountId=${raceAccount}",
            comment="Reads the ledger directly rather than trusting the withdraw responses.",
            children=code_assert("Response Code = 200", "200")
            + json_assert("EXPECT exactly ${expectedWithdrawals} debit entries in ledger", "$.data.withdrawals", "${expectedWithdrawals}")
            + json_assert("EXPECT ledger debits total ${expectedLedgerDebits}", "$.data.ledgerDebits", "${expectedLedgerDebits}")
            + json_assert("EXPECT final balance ${expectedFinalBalance}", "$.data.account.balance", "${expectedFinalBalance}"),
        )
        + http(
            "VERIFY idempotent transfer applied once",
            "GET",
            "/api/admin/state?accountId=ACC-1001",
            children=code_assert("Response Code = 200", "200")
            + json_assert("EXPECT exactly 1 debit entry (no duplicate processing)", "$.data.withdrawals", "1")
            + json_assert("EXPECT ledger debit total 50", "$.data.ledgerDebits", "50")
            + json_assert("EXPECT balance 499950", "$.data.account.balance", "499950"),
        ),
    )

    body = (
        udv("User Defined Variables", udv_pairs, "Run: -Jmode=unsafe (expect FAIL = race detected) and -Jmode=safe (expect PASS).")
        + http_defaults()
        + setup
        + race
        + retry
        + verify
        + listener("View Results Tree", "ViewResultsFullVisualizer", comment="Shows each racer's response and the verification assertions.")
        + listener("Summary Report", "SummaryReport")
    )
    plan = test_plan(
        "TestJedi_Concurrency_Test",
        "Race-condition and duplicate-submission tests. Thread groups run one after another.",
        body,
        serialize=True,  # setUp -> TG1 -> TG2 -> tearDown, one at a time
    )
    return plan


def write(name, xml):
    xml_dom(xml)  # raises if not well formed
    path = os.path.join(ROOT, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
    print("wrote", path, f"({len(xml):,} bytes)")


if __name__ == "__main__":
    write("TestJedi_Fintech_Performance_Test.jmx", build_main())
    write("TestJedi_Concurrency_Test.jmx", build_concurrency())
