#!/usr/bin/env node
/**
 * Scenario runner: starts the mock API (if needed), resets its state, runs JMeter
 * in NON-GUI mode, writes the .jtl + HTML dashboard, then summarises the result.
 *
 *   node scripts/run-tests.js <scenario ...|all> [--dry-run] [--no-server]
 *
 * Scenarios: functional, negative-assertion, data-exhaustion, baseline, load,
 *            stress, spike, endurance (long - NOT in "all"), concurrency-unsafe,
 *            concurrency-safe
 *
 * JMeter is found via $JMETER_HOME/bin/jmeter or "jmeter" on PATH.
 * Each run: deletes the old .jtl and HTML folder first (JMeter refuses a non-empty
 * -o directory and APPENDS to an existing -l file), so results are never mixed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || '3000';
const MAIN = 'TestJedi_Fintech_Performance_Test.jmx';
const CONC = 'TestJedi_Concurrency_Test.jmx';

// Acceptance criteria used for the verdicts (state and justify these in your report).
const SLA = 'p95<=500,errorPct<=1';

const perf = { debug: 'false', negativeTests: 'false' };
const SCENARIOS = {
  'functional':         { plan: MAIN, out: 'functional', props: { threads: 1, rampUp: 1, loops: 1, debug: 'true', negativeTests: 'true' } },
  'negative-assertion': { plan: MAIN, out: 'negative-assertion', props: { threads: 1, rampUp: 1, loops: 1, expectedStatus: 'INACTIVE', debug: 'true', negativeTests: 'false' }, note: 'Deliberately expects status INACTIVE - the "Get Profile" status assertion MUST fail.' },
  'data-exhaustion':    { plan: MAIN, out: 'data-exhaustion', props: { threads: 5, rampUp: 1, loops: 1, csvRecycle: 'false', csvStopThread: 'true', ...perf }, note: 'CSV has 3 rows, 5 threads, recycle=false, stopThread=true: threads 4 and 5 stop cleanly.' },
  'baseline':           { plan: MAIN, out: 'baseline', props: { threads: 1, rampUp: 1, loops: 10, thinkTime: 200, ...perf }, sla: SLA },
  'load':               { plan: MAIN, out: 'load-test', props: { threads: 10, rampUp: 60, loops: 70, thinkTime: 500, ...perf }, sla: SLA },
  'stress':             { plan: MAIN, out: 'stress-test', props: { threads: 300, rampUp: 300, loops: 30, thinkTime: 200, ...perf }, sla: SLA },
  'spike':              { plan: MAIN, out: 'spike-test', props: { threads: 5, rampUp: 5, loops: 60, thinkTime: 500, spikeThreads: 200, spikeRamp: 5, spikeDelay: 60, spikeLoops: 10, ...perf }, sla: SLA },
  'endurance':          { plan: MAIN, out: 'endurance-test', props: { threads: 10, rampUp: 30, loops: 700, thinkTime: 500, ...perf }, sla: SLA, long: true },
  'concurrency-unsafe': { plan: CONC, out: 'concurrency-unsafe', props: { mode: 'unsafe', racers: 2 }, note: 'EXPECTED to FAIL the tearDown assertions: that failure IS the race-condition finding.' },
  'concurrency-safe':   { plan: CONC, out: 'concurrency-safe', props: { mode: 'safe', racers: 2 }, note: 'EXPECTED to PASS: the server serialises withdrawals.' },
};

const args = process.argv.slice(2);
const dry = args.includes('--dry-run'), noServer = args.includes('--no-server');
let wanted = args.filter((a) => !a.startsWith('--'));
if (!wanted.length) { console.error('Usage: node scripts/run-tests.js <scenario ...|all> [--dry-run] [--no-server]\nScenarios: ' + Object.keys(SCENARIOS).join(', ')); process.exit(2); }
if (wanted[0] === 'all') wanted = Object.keys(SCENARIOS).filter((k) => !SCENARIOS[k].long);
for (const w of wanted) if (!SCENARIOS[w]) { console.error('Unknown scenario: ' + w); process.exit(2); }

const jmeterBin = process.env.JMETER_HOME
  ? path.join(process.env.JMETER_HOME, 'bin', process.platform === 'win32' ? 'jmeter.bat' : 'jmeter')
  : 'jmeter';

const req = (method, p) => new Promise((resolve) => {
  const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  r.on('error', () => resolve(0)); r.end();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureServer() {
  if (await req('GET', '/health') === 200) { console.log('Mock API already running.'); return null; }
  if (noServer) { console.error('Mock API not reachable and --no-server given.'); process.exit(1); }
  console.log('Starting mock API...');
  const child = spawn(process.execPath, [path.join(ROOT, 'mock-api', 'server.js')], { stdio: 'ignore', env: { ...process.env, PORT } });
  for (let i = 0; i < 30; i++) { await sleep(200); if (await req('GET', '/health') === 200) return child; }
  console.error('Mock API failed to start.'); process.exit(1);
}

function run(name) {
  const sc = SCENARIOS[name];
  const jtl = path.join(ROOT, 'results', sc.out + '.jtl');
  const html = path.join(ROOT, 'reports', 'html', sc.out);
  fs.mkdirSync(path.join(ROOT, 'results'), { recursive: true });
  fs.rmSync(jtl, { force: true }); fs.rmSync(html, { recursive: true, force: true });
  const cmd = [
    '-n', '-t', path.join(ROOT, sc.plan), '-l', jtl, '-e', '-o', html,
    '-Jhost=127.0.0.1', `-Jport=${PORT}`,
    '-Jjmeter.save.saveservice.assertion_results_failure_message=true',
    ...Object.entries(sc.props).map(([k, v]) => `-J${k}=${v}`),
  ];
  console.log(`\n=== ${name} ===${sc.note ? '\n' + sc.note : ''}\n${jmeterBin} ${cmd.join(' ')}`);
  if (dry) return { name, skipped: true };
  const t0 = Date.now();
  const r = spawnSync(jmeterBin, cmd, { stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' });
  if (r.error) { console.error('Could not start JMeter: ' + r.error.message + '\nInstall JMeter 5.6.x and put it on PATH, or set JMETER_HOME.'); process.exit(1); }
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`JMeter exit code: ${r.status}  (${secs}s).  NOTE: exit code 0 only means JMeter ran - it does NOT mean assertions or SLAs passed.`);
  if (fs.existsSync(jtl)) {
    const sumArgs = [path.join(__dirname, 'summarize-jtl.js'), jtl, '--out', path.join(ROOT, 'results', sc.out + '-summary.md')];
    if (sc.sla) sumArgs.push('--criteria', sc.sla);
    spawnSync(process.execPath, sumArgs, { stdio: 'inherit' });
  }
  return { name, exit: r.status, secs };
}

(async () => {
  const server = dry ? null : await ensureServer();
  const done = [];
  for (const w of wanted) {
    if (!dry) await req('POST', '/api/admin/reset');   // known starting state for every scenario
    done.push(run(w));
  }
  if (server) server.kill();
  console.log('\nFinished:', done.map((d) => d.name + (d.exit !== undefined ? `(exit ${d.exit})` : '')).join(', '));
})();
