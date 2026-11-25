/**
 * TestJedi Mock Digital Banking API
 * ---------------------------------
 * Zero-dependency Node.js server (Node 16+). Run:  node server.js
 *
 * PURPOSE: a local, authorised target for JMeter functional, load, stress,
 * spike and concurrency testing. All data is fictional and held in memory.
 *
 * ENVIRONMENT VARIABLES (all optional)
 *   PORT              listen port                              (default 3000)
 *   BASE_LATENCY_MS   minimum simulated service time           (default 20)
 *   JITTER_MS         random extra latency 0..JITTER_MS        (default 30)
 *   DEGRADE_AFTER     in-flight requests before latency grows  (default 25)
 *   DEGRADE_MS        extra ms per in-flight req above that    (default 8)
 *   OVERLOAD_AT       in-flight requests at which 503s start   (default 120)
 *
 * LIMITATIONS (also documented in README): latency/errors are SIMULATED
 * from in-flight request count. The numbers describe this mock, not a real
 * banking backend.
 */
'use strict';
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const BASE_LATENCY_MS = Number(process.env.BASE_LATENCY_MS || 20);
const JITTER_MS = Number(process.env.JITTER_MS || 30);
const DEGRADE_AFTER = Number(process.env.DEGRADE_AFTER || 25);
const DEGRADE_MS = Number(process.env.DEGRADE_MS || 8);
const OVERLOAD_AT = Number(process.env.OVERLOAD_AT || 120);

// ---------- In-memory data (fictional sandbox accounts) ----------
const USERS = {
  'user01@example.test': { password: 'TestPassword01', id: 101, name: 'Ada Test',  accountId: 'ACC-1001' },
  'user02@example.test': { password: 'TestPassword02', id: 102, name: 'Bola Test', accountId: 'ACC-1002' },
  'user03@example.test': { password: 'TestPassword03', id: 103, name: 'Chidi Test', accountId: 'ACC-1003' },
  // Dedicated account for race-condition testing (not in test-users.csv)
  'race@example.test':   { password: 'RacePassword01', id: 199, name: 'Race Test', accountId: 'ACC-RACE' },
};
const INITIAL_BALANCE = { 'ACC-1001': 500000, 'ACC-1002': 500000, 'ACC-1003': 500000, 'ACC-RACE': 1000 };

const state = { accounts: {}, tx: {}, transfers: {}, idem: {}, profiles: {}, beneficiaries: {}, tokens: {} };
function resetState() {
  state.accounts = {}; state.tx = {}; state.transfers = {}; state.idem = {};
  state.profiles = {}; state.beneficiaries = {}; state.tokens = {};
  for (const [email, u] of Object.entries(USERS)) {
    state.accounts[u.accountId] = { id: u.accountId, ownerId: u.id, balance: INITIAL_BALANCE[u.accountId], currency: 'NGN', version: 0 };
    state.tx[u.accountId] = [{ id: 'TX-SEED-' + u.id, type: 'CREDIT', amount: INITIAL_BALANCE[u.accountId], narration: 'Opening balance', ts: new Date().toISOString() }];
    state.profiles[u.id] = { userId: u.id, name: u.name, email, phone: '08000000000', status: 'ACTIVE' };
    state.beneficiaries[u.id] = {};
  }
}
resetState();

// ---------- Helpers ----------
let inFlight = 0, peakInFlight = 0, totalRequests = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (res, code, body) => {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s), 'X-Mock-InFlight': String(inFlight) });
  res.end(s);
};
const ok = (res, data, code = 200) => send(res, code, { success: true, data });
const fail = (res, code, error, message) => send(res, code, { success: false, error, message });
const readBody = (req) => new Promise((resolve) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve(null); } });
});
function authUser(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer (.+)$/.exec(h);
  return m ? state.tokens[m[1]] || null : null;
}
const newTx = (acc, type, amount, narration) => {
  const t = { id: 'TX-' + crypto.randomBytes(5).toString('hex'), type, amount, narration, ts: new Date().toISOString() };
  state.tx[acc].unshift(t); return t;
};

// Mutex used by the "safe" withdrawal endpoint
let lockChain = Promise.resolve();
const withLock = (fn) => { const run = lockChain.then(fn); lockChain = run.catch(() => {}); return run; };

// ---------- Router ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  // Unauthenticated utility endpoints
  if (m === 'GET' && path === '/health') return ok(res, { status: 'UP', inFlight, peakInFlight, totalRequests });
  if (m === 'POST' && path === '/api/admin/reset') { resetState(); peakInFlight = 0; totalRequests = 0; return ok(res, { reset: true }); }
  if (m === 'GET' && path === '/api/admin/state') {
    const id = url.searchParams.get('accountId');
    const a = state.accounts[id];
    if (!a) return fail(res, 404, 'NOT_FOUND', 'Unknown account');
    const debits = state.tx[id].filter((t) => t.type === 'DEBIT');
    return ok(res, {
      account: a,
      transactionCount: state.tx[id].length,
      withdrawals: debits.length,                                   // number of DEBIT ledger entries
      ledgerDebits: debits.reduce((s, t) => s + t.amount, 0),       // total debited per the ledger
    });
  }
  if (m === 'POST' && path === '/api/admin/set-balance') {
    const b = (await readBody(req)) || {}; const a = state.accounts[b.accountId];
    if (!a || typeof b.balance !== 'number') return fail(res, 400, 'BAD_REQUEST', 'accountId and numeric balance required');
    a.balance = b.balance; state.tx[a.id] = []; return ok(res, { account: a });
  }

  // ---- POST /api/auth/login
  if (m === 'POST' && path === '/api/auth/login') {
    const b = await readBody(req);
    if (!b) return fail(res, 400, 'BAD_JSON', 'Malformed JSON body');
    const u = USERS[b.username];
    if (!u || u.password !== b.password) return fail(res, 401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    const token = crypto.randomBytes(16).toString('hex');
    state.tokens[token] = { id: u.id, email: b.username, accountId: u.accountId };
    return ok(res, { accessToken: token, user: { id: u.id, email: b.username, accountId: u.accountId } });
  }

  // Everything below requires a valid bearer token
  const who = authUser(req);
  if (!who) return fail(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  let r;
  // ---- GET /api/users/:id/profile   |  PUT /api/users/:id/profile
  if ((r = /^\/api\/users\/(\d+)\/profile$/.exec(path))) {
    const id = Number(r[1]);
    if (id !== who.id) return fail(res, 403, 'FORBIDDEN', 'Cannot access another user\'s profile');
    if (m === 'GET') return ok(res, state.profiles[id]);
    if (m === 'PUT') {
      const b = await readBody(req);
      if (!b || (b.name === undefined && b.phone === undefined)) return fail(res, 400, 'BAD_REQUEST', 'name or phone required');
      if (b.name !== undefined) state.profiles[id].name = String(b.name);
      if (b.phone !== undefined) state.profiles[id].phone = String(b.phone);
      return ok(res, state.profiles[id]);
    }
  }
  // ---- GET /api/accounts/:id/balance
  if (m === 'GET' && (r = /^\/api\/accounts\/([\w-]+)\/balance$/.exec(path))) {
    const a = state.accounts[r[1]];
    if (!a) return fail(res, 404, 'NOT_FOUND', 'Account not found');
    if (a.ownerId !== who.id) return fail(res, 403, 'FORBIDDEN', 'Not your account');
    return ok(res, { accountId: a.id, balance: a.balance, currency: a.currency });
  }
  // ---- GET /api/accounts/:id/transactions
  if (m === 'GET' && (r = /^\/api\/accounts\/([\w-]+)\/transactions$/.exec(path))) {
    const a = state.accounts[r[1]];
    if (!a) return fail(res, 404, 'NOT_FOUND', 'Account not found');
    if (a.ownerId !== who.id) return fail(res, 403, 'FORBIDDEN', 'Not your account');
    const limit = Math.min(Number(url.searchParams.get('limit') || 10), 100);
    const items = state.tx[a.id].slice(0, limit);
    return ok(res, { accountId: a.id, count: items.length, items });
  }
  // ---- POST /api/transfers   (supports Idempotency-Key)
  if (m === 'POST' && path === '/api/transfers') {
    const b = await readBody(req);
    if (!b || !b.fromAccount || !b.toAccount || typeof b.amount !== 'number' || b.amount <= 0) return fail(res, 400, 'BAD_REQUEST', 'fromAccount, toAccount and positive numeric amount required');
    const from = state.accounts[b.fromAccount], to = state.accounts[b.toAccount];
    if (!from || !to) return fail(res, 404, 'NOT_FOUND', 'Unknown account');
    if (from.ownerId !== who.id) return fail(res, 403, 'FORBIDDEN', 'Not your account');
    const key = req.headers['idempotency-key'];
    if (key && state.idem[key]) return ok(res, state.transfers[state.idem[key]], 200); // replay, no second debit
    if (from.balance < b.amount) return fail(res, 422, 'INSUFFICIENT_FUNDS', 'Insufficient funds');
    from.balance -= b.amount; to.balance += b.amount;
    const t = { transferId: 'TRF-' + crypto.randomBytes(5).toString('hex'), fromAccount: b.fromAccount, toAccount: b.toAccount, amount: b.amount, status: 'PENDING', createdAt: new Date().toISOString() };
    state.transfers[t.transferId] = t; if (key) state.idem[key] = t.transferId;
    newTx(from.id, 'DEBIT', b.amount, 'Transfer ' + t.transferId); newTx(to.id, 'CREDIT', b.amount, 'Transfer ' + t.transferId);
    return ok(res, t, 201);
  }
  // ---- GET /api/transfers/:id   (PENDING -> COMPLETED after ~0.3s)
  if (m === 'GET' && (r = /^\/api\/transfers\/([\w-]+)$/.exec(path))) {
    const t = state.transfers[r[1]];
    if (!t) return fail(res, 404, 'NOT_FOUND', 'Transfer not found');
    if (Date.now() - Date.parse(t.createdAt) > 300) t.status = 'COMPLETED';
    return ok(res, t);
  }
  // ---- POST /api/beneficiaries  |  DELETE /api/beneficiaries/:id
  if (m === 'POST' && path === '/api/beneficiaries') {
    const b = await readBody(req);
    if (!b || !b.name || !b.accountNumber) return fail(res, 400, 'BAD_REQUEST', 'name and accountNumber required');
    const id = 'BEN-' + crypto.randomBytes(4).toString('hex');
    state.beneficiaries[who.id][id] = { beneficiaryId: id, name: b.name, accountNumber: b.accountNumber };
    return ok(res, state.beneficiaries[who.id][id], 201);
  }
  if (m === 'DELETE' && (r = /^\/api\/beneficiaries\/([\w-]+)$/.exec(path))) {
    if (!state.beneficiaries[who.id][r[1]]) return fail(res, 404, 'NOT_FOUND', 'Beneficiary not found');
    delete state.beneficiaries[who.id][r[1]];
    return ok(res, { deleted: true, beneficiaryId: r[1] });
  }
  // ---- POST /api/accounts/:id/withdraw?mode=unsafe|safe   (concurrency target)
  if (m === 'POST' && (r = /^\/api\/accounts\/([\w-]+)\/withdraw$/.exec(path))) {
    const a = state.accounts[r[1]];
    if (!a) return fail(res, 404, 'NOT_FOUND', 'Account not found');
    if (a.ownerId !== who.id) return fail(res, 403, 'FORBIDDEN', 'Not your account');
    const b = await readBody(req);
    if (!b || typeof b.amount !== 'number' || b.amount <= 0) return fail(res, 400, 'BAD_REQUEST', 'positive numeric amount required');
    const mode = url.searchParams.get('mode') || 'unsafe';
    const doWithdraw = async () => {
      const seen = a.balance;                 // 1. read
      await sleep(40);                        // 2. simulated processing gap (DB round trip)
      if (seen < b.amount) return { code: 422, body: ['INSUFFICIENT_FUNDS', 'Insufficient funds'] };
      a.balance = seen - b.amount;            // 3. write based on the STALE read when unsafe
      const t = newTx(a.id, 'DEBIT', b.amount, 'Withdrawal');
      return { code: 200, body: { transactionId: t.id, newBalance: a.balance } };
    };
    // UNSAFE: no lock -> check-then-act race (lost update / overdraft). SAFE: serialised.
    const out = mode === 'safe' ? await withLock(doWithdraw) : await doWithdraw();
    return out.code === 200 ? ok(res, out.body) : fail(res, out.code, ...out.body);
  }

  return fail(res, 404, 'NOT_FOUND', `No route for ${m} ${path}`);
}

// ---------- Server with simulated load behaviour ----------
const server = http.createServer(async (req, res) => {
  inFlight++; totalRequests++; if (inFlight > peakInFlight) peakInFlight = inFlight;
  try {
    const isUtil = req.url.startsWith('/health') || req.url.startsWith('/api/admin');
    if (!isUtil) {
      if (inFlight >= OVERLOAD_AT && Math.random() < 0.5) {
        await sleep(5);
        return fail(res, 503, 'SERVICE_UNAVAILABLE', 'Mock server overloaded');
      }
      const extra = Math.max(0, inFlight - DEGRADE_AFTER) * DEGRADE_MS;
      await sleep(BASE_LATENCY_MS + Math.random() * JITTER_MS + extra);
    }
    await handle(req, res);
  } catch (e) {
    if (!res.headersSent) fail(res, 500, 'INTERNAL_ERROR', String(e.message || e));
  } finally { inFlight--; }
});
server.keepAliveTimeout = 65000;
server.listen(PORT, '127.0.0.1', () => console.log(`TestJedi mock banking API listening on http://127.0.0.1:${PORT}`));
