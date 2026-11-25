#!/usr/bin/env node
/**
 * Summarise a JMeter .jtl (CSV format) into the Part G metrics table.
 *
 *   node scripts/summarize-jtl.js results/load-test.jtl
 *   node scripts/summarize-jtl.js results/load-test.jtl --criteria "p95<=500,errorPct<=1" --out results/load-test-summary.md
 *   node scripts/summarize-jtl.js results/load-test.jtl --exclude-transactions
 *
 * Only MEASURED values are printed. Pass/fail verdicts are produced ONLY for
 * criteria you pass in --criteria; with none supplied the verdict is "no
 * criteria defined" (we never invent a threshold).
 *
 * Percentiles use the nearest-rank method; JMeter's dashboard may differ by a
 * few ms because it interpolates differently. Quote the dashboard in the report
 * and use this script as a cross-check.
 */
'use strict';
const fs = require('fs');

function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const pct = (sorted, p) => (sorted.length ? sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] : 0);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const isTx = (label) => /\(Transaction Controller\)/i.test(label);

function stats(samples, spanSec) {
  const el = samples.map((s) => s.elapsed).sort((a, b) => a - b);
  const errs = samples.filter((s) => !s.success).length;
  return {
    samples: samples.length, avg: mean(el), median: pct(el, 50), p90: pct(el, 90), p95: pct(el, 95), p99: pct(el, 99),
    min: el[0] || 0, max: el[el.length - 1] || 0, errors: errs,
    errorPct: samples.length ? (errs / samples.length) * 100 : 0,
    throughput: spanSec > 0 ? samples.length / spanSec : 0,
  };
}

function evaluate(criteria, overall) {
  return criteria.map((c) => {
    const m = /^\s*(\w+)\s*(<=|>=|<|>)\s*([\d.]+)\s*$/.exec(c);
    if (!m || !(m[1] in overall)) return { text: c, verdict: 'INVALID CRITERION' };
    const v = overall[m[1]], t = Number(m[3]);
    const pass = { '<=': v <= t, '>=': v >= t, '<': v < t, '>': v > t }[m[2]];
    return { text: c, actual: v, verdict: pass ? 'PASS' : 'FAIL' };
  });
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--') && !['--criteria', '--out'].includes(args[args.indexOf(a) - 1]));
  if (!file || !fs.existsSync(file)) { console.error('Usage: node summarize-jtl.js <file.jtl> [--criteria "p95<=500,errorPct<=1"] [--out file.md] [--exclude-transactions]'); process.exit(2); }
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const criteria = (opt('--criteria') || '').split(',').map((x) => x.trim()).filter(Boolean);
  const excludeTx = args.includes('--exclude-transactions');

  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const header = rows.shift();
  const col = (n) => header.indexOf(n);
  const [iT, iE, iL, iC, iS, iF, iTh] = ['timeStamp', 'elapsed', 'label', 'responseCode', 'success', 'failureMessage', 'allThreads'].map(col);
  if ([iT, iE, iL, iS].some((i) => i < 0)) { console.error('Not a JMeter CSV JTL (missing timeStamp/elapsed/label/success columns).'); process.exit(2); }

  let all = rows.filter((r) => r.length > iS).map((r) => ({
    ts: Number(r[iT]), elapsed: Number(r[iE]), label: r[iL], code: r[iC], success: r[iS] === 'true', failure: iF >= 0 ? r[iF] : '', threads: iTh >= 0 ? Number(r[iTh]) : 0,
  }));
  if (excludeTx) all = all.filter((s) => !isTx(s.label));
  if (!all.length) { console.error('No samples found.'); process.exit(1); }

  const start = Math.min(...all.map((s) => s.ts)), end = Math.max(...all.map((s) => s.ts + s.elapsed));
  const span = (end - start) / 1000;
  const overall = stats(all, span);
  const labels = [...new Set(all.map((s) => s.label))];
  const perLabel = labels.map((l) => ({ label: l, tx: isTx(l), ...stats(all.filter((s) => s.label === l), span) }));
  const endpoints = perLabel.filter((x) => !x.tx);
  const slowest = [...endpoints].sort((a, b) => b.p95 - a.p95)[0];
  const errprone = [...endpoints].sort((a, b) => b.errorPct - a.errorPct)[0];
  const peakThreads = Math.max(...all.map((s) => s.threads || 0));

  // Top failure reasons
  const reasons = {};
  all.filter((s) => !s.success).forEach((s) => { const k = `${s.code} | ${(s.failure || '').slice(0, 90)}`; reasons[k] = (reasons[k] || 0) + 1; });

  const out = [];
  out.push(`# JTL summary: ${file}`, '', `Test window: ${new Date(start).toISOString()} -> ${new Date(end).toISOString()} (${f1(span)} s)  `, `Peak active threads seen in samples: ${peakThreads}`, excludeTx ? '_Transaction Controller rows excluded._' : '_Totals include Transaction Controller rows, like the JMeter dashboard._', '');
  out.push('## Overall metrics (Part G)', '', '| Metric | Your result |', '|---|---|');
  out.push(`| Total requests/samples | ${overall.samples} |`, `| Average response time | ${f1(overall.avg)} ms |`, `| Median response time | ${f1(overall.median)} ms |`, `| 90th percentile | ${f1(overall.p90)} ms |`, `| 95th percentile | ${f1(overall.p95)} ms |`, `| 99th percentile | ${f1(overall.p99)} ms |`, `| Throughput | ${f1(overall.throughput)} req/s |`, `| Error percentage | ${f1(overall.errorPct)} % (${overall.errors} failed) |`);
  out.push(`| Slowest endpoint (highest p95) | ${slowest.label} (p95 ${f1(slowest.p95)} ms, avg ${f1(slowest.avg)} ms) |`);
  out.push(`| Most error-prone endpoint | ${errprone.errorPct > 0 ? `${errprone.label} (${f1(errprone.errorPct)} %)` : 'none - no endpoint had errors'} |`, '');
  out.push('## Per-endpoint', '', '| Label | Samples | Avg | Median | p90 | p95 | p99 | Max | Error % |', '|---|---|---|---|---|---|---|---|---|');
  perLabel.forEach((x) => out.push(`| ${x.label}${x.tx ? ' *(tx)*' : ''} | ${x.samples} | ${f1(x.avg)} | ${f1(x.median)} | ${f1(x.p90)} | ${f1(x.p95)} | ${f1(x.p99)} | ${x.max} | ${f1(x.errorPct)} |`));
  out.push('', '(times in ms)', '');
  if (Object.keys(reasons).length) {
    out.push('## Failure reasons (top 8)', '', '| Count | Response code | Failure message |', '|---|---|---|');
    Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, n]) => { const [c, m] = k.split(' | '); out.push(`| ${n} | ${c} | ${m.replace(/\|/g, '/')} |`); });
    out.push('');
  }
  out.push('## Acceptance criteria', '');
  if (!criteria.length) out.push('No criteria supplied (`--criteria`). **No pass/fail verdict can be made without a defined threshold.**');
  else { out.push('| Criterion | Measured | Verdict |', '|---|---|---|'); evaluate(criteria, overall).forEach((r) => out.push(`| ${r.text} | ${r.actual === undefined ? '-' : f1(r.actual)} | **${r.verdict}** |`)); }

  const text = out.join('\n') + '\n';
  const outFile = opt('--out');
  if (outFile) { fs.writeFileSync(outFile, text); console.log(`wrote ${outFile}`); }
  console.log(text);
}
main();
