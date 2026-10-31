// 0.9.10: reports reach the owner (proxy 'report' / 'listReports'), release approvals ('approveRelease' + GET approval).
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs'; import vm from 'node:vm'; import { createHash } from 'node:crypto';
import { makeReport, addReport } from '../src/aireport.js';
import { enqueue, queued, flushReports, wirePayload, wasSent, fetchOwnerReports } from '../src/reportsync.js';
const SRC = readFileSync(new URL('../proxy/apps-script/Code.gs', import.meta.url), 'utf8');
function sheetApp() {
  const books = {}; let n = 0;
  const mk = () => { const sheets = {}; const id = 'ss' + (++n); const ss = { getId: () => id, getSheetByName: k => sheets[k] || null, insertSheet: k => { const rows = []; sheets[k] = { rows, appendRow: r => rows.push(r), getLastRow: () => rows.length, getRange: (r, c, nr) => ({ getValues: () => rows.slice(r - 1, r - 1 + nr).map(x => [x[c - 1]]) }), getDataRange: () => ({ getValues: () => rows.map(x => x.slice()) }) }; return sheets[k]; } }; books[id] = ss; return ss; };
  return { books, api: { create: () => mk(), openById: id => books[id] } };
}
function load({ owner = 'vanshbahamanwa021430@gmail.com' } = {}) {
  const props = { GEMINI_KEY: 'AIzaFAKE', APP_TOKEN: 'tok', ALLOWED_AUD: 'web-client' }, mails = [], sa = sheetApp();
  const ctx = { PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, getProperties: () => ({ ...props }), deleteProperty: k => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, Logger: { log() {} },
    Utilities: { getUuid: () => 'u', formatDate: (d, z, f) => f.length > 10 ? '2026-10-31-18-00' : '2026-10-31', DigestAlgorithm: { SHA_256: 1 }, computeDigest: (a, s) => [...createHash('sha256').update(s).digest()] },
    ContentService: { MimeType: { JSON: 1 }, createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }) },
    UrlFetchApp: { fetch: u => { const tok = decodeURIComponent(u.split('id_token=')[1] || ''); return tok === 'good' ? { getResponseCode: () => 200, getContentText: () => JSON.stringify({ aud: 'web-client', email: owner, email_verified: 'true', exp: String(Date.now() / 1000 + 600) }) } : { getResponseCode: () => 400, getContentText: () => '{}' }; } },
    SpreadsheetApp: sa.api, MailApp: { sendEmail: (to, subj, body) => mails.push({ to, subj, body }) },
    JSON, Date, Number, String, Array, Math, Object, encodeURIComponent };
  vm.createContext(ctx); vm.runInContext(SRC, ctx); return { ctx, props, mails, sa };
}
const dev = 'device-00000000-0000-0000-0000-000000000000';
const post = (g, b) => g.ctx.doPost({ postData: { contents: JSON.stringify({ token: 'tok', device: dev, eligible: true, ...b }) } });
const rep = (id = 'r1', extra = {}) => ({ action: 'report', data: { id, category: 'inaccurate', kind: 'smarty', version: '0.9.10', answer: 'Mail me at kid@example.com or +91 98765 43210, key AIzaSyA' + 'x'.repeat(33), question: 'q', note: 'n', ...extra } });

test('proxy report: sanitised row in the Sheet, owner emailed, duplicates ignored', () => {
  const g = load(); const r = post(g, rep());
  assert.equal(r.status, 200); const sh = Object.values(g.sa.books)[0].getSheetByName('Reports'); assert.equal(sh.rows.length, 2);
  const row = sh.rows[1].join(' '); assert.ok(!/kid@example|98765|AIzaSy/.test(row), row);
  assert.equal(g.mails.length, 1); assert.equal(g.mails[0].to, 'vanshbahamanwa021430@gmail.com'); assert.ok(!/kid@example/.test(g.mails[0].body));
  assert.equal(post(g, rep()).body.duplicate, true); assert.equal(sh.rows.length, 2);
});
test('proxy report: rate limit per device, refused without 18+ flag, bad category', () => {
  const g = load(); for (let i = 0; i < 10; i++) assert.equal(post(g, rep('a' + i)).status, 200);
  const r = post(g, rep('a10')); assert.equal(r.status, 429);
  assert.equal(post(g, { ...rep('b'), eligible: false }).status, 403);
  assert.equal(post(g, rep('c', { category: 'spam' })).status, 400);
});
test('proxy listReports and approveRelease are owner-only (verified ID token)', () => {
  const g = load(); post(g, rep());
  assert.equal(post(g, { action: 'listReports' }).status, 403);
  assert.equal(post(g, { action: 'listReports', idToken: 'bad' }).status, 403);
  const l = post(g, { action: 'listReports', idToken: 'good' }); assert.equal(l.status, 200); assert.equal(l.body.reports.length, 1);
  assert.equal(post(g, { action: 'approveRelease', data: { version: '0.9.10', buildId: 'abc1234' } }).status, 403);
  const o = load({ owner: 'someone@else.com' }); assert.equal(post(o, { action: 'approveRelease', idToken: 'good', data: { version: '0.9.10', buildId: 'abc1234' } }).status, 403);
  assert.equal(g.ctx.doGet({ parameter: { action: 'approval', version: '0.9.10', build: 'abc1234' } }).body.approved, false);
  assert.equal(post(g, { action: 'approveRelease', idToken: 'good', data: { version: '0.9.10', buildId: 'abc1234', timestamp: 'now' } }).status, 200);
  assert.equal(g.ctx.doGet({ parameter: { action: 'approval', version: '0.9.10', build: 'abc1234' } }).body.approved, true);
  assert.equal(g.ctx.doGet({ parameter: { action: 'approval', version: '0.9.10', build: 'fff9999' } }).body.approved, false);
  assert.equal(post(g, { action: 'approveRelease', idToken: 'good', data: { version: 'x', buildId: 'zz' } }).status, 400);
});
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
test('client: wire payload has no email / whole document; offline queue retries; local copy kept', async () => {
  const s = mem(); const r = addReport(makeReport({ category: 'harmful', answer: 'A'.repeat(5000) + ' x@y.com', context: 'doc '.repeat(2000), note: 'call 98765 43210' }), s);
  const w = wirePayload(r); assert.ok(w.answer.length <= 1500 && w.question.length <= 300); assert.ok(!/x@y\.com|98765/.test(JSON.stringify(w))); assert.ok(!('email' in w));
  enqueue(r.id, s); let up = false; const send = async () => (up ? { status: 200, body: {} } : { status: 0, body: {} });
  assert.deepEqual(await flushReports(send, s), { sent: 0, left: 1 }); assert.equal(queued(s).length, 1);
  up = true; assert.deepEqual(await flushReports(send, s), { sent: 1, left: 0 }); assert.ok(wasSent(r.id, s)); assert.equal(queued(s).length, 0);
  assert.ok(JSON.parse(s.getItem('prvlar-ai-reports')).length === 1);
  await assert.rejects(fetchOwnerReports(async () => ({ status: 403, body: { error: { message: 'Only the owner' } } })), /Only the owner/);
});
