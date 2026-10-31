import test from 'node:test'; import assert from 'node:assert/strict';
import { confirmAdult, clearAdult, ageStatus, isAdult, confirmedOn, migrateAge } from '../src/age.js';
import { makeReport, addReport, listReports, setStatus, exportReports } from '../src/aireport.js';
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), dump: () => [...m.values()].join('|') }; };
const T = new Date(2026, 9, 31);
test('18+ confirmation: only the flag and the date are stored', () => {
  const s = mem(); assert.equal(ageStatus(s), 'unknown'); assert.ok(!isAdult(s));
  confirmAdult(s, T); assert.ok(isAdult(s)); assert.equal(confirmedOn(s), '2026-10-31');
  assert.deepEqual(Object.keys(JSON.parse(s.getItem('prvlar-age'))).sort(), ['at', 'confirmed']);
  clearAdult(s); assert.equal(ageStatus(s), 'unknown');
});
test('0.9.9 DOB-era records are converted: adult kept with its date, minor cleared', () => {
  const a = mem(); a.setItem('prvlar-age', JSON.stringify({ result: 'adult', checked: '2026-10-30' })); migrateAge(a); assert.deepEqual(JSON.parse(a.getItem('prvlar-age')), { confirmed: true, at: '2026-10-30' });
  const m = mem(); m.setItem('prvlar-age', JSON.stringify({ result: 'minor', checked: '2026-10-30' })); assert.equal(ageStatus(m), 'unknown'); assert.equal(m.getItem('prvlar-age'), null);
  const j = mem(); j.setItem('prvlar-age', '{bad'); assert.equal(ageStatus(j), 'unknown');
});
test('AI answer report: categories, excerpt limits, status audit trail, export', () => {
  const s = mem();
  assert.throws(() => makeReport({ category: 'other', answer: 'x' }));
  const r = addReport(makeReport({ category: 'inaccurate', note: 'wrong unit', answer: 'M = wL/8', context: 'doc '.repeat(500) }), s);
  assert.ok(r.context.length <= 300); assert.equal(r.status, 'new');
  setStatus(r.id, 'reviewing', 'owner@x', s); setStatus(r.id, 'resolved', 'owner@x', s);
  const got = listReports(s)[0]; assert.equal(got.status, 'resolved'); assert.equal(got.audit.length, 3); assert.match(got.audit[2].action, /reviewing → resolved/); assert.equal(got.audit[1].by, 'owner@x');
  assert.throws(() => setStatus(r.id, 'bogus', 'x', s));
  assert.equal(JSON.parse(exportReports(s)).reports.length, 1);
});
import { aiDecision } from '../src/aigate.js';
test('ECC H1: every non-local AI path needs adult + consent', () => {
  assert.equal(aiDecision({ local: true, age: 'minor' }), 'ok');
  assert.equal(aiDecision({ age: 'unknown', consent: true }), 'ask-age');
  assert.equal(aiDecision({ age: 'minor', consent: true }), 'minor');
  assert.equal(aiDecision({ age: 'adult', consent: false }), 'ask-consent');
  assert.equal(aiDecision({ age: 'adult', consent: true }), 'ok');
});
import { scrub } from '../src/aireport.js';
import { createRequire } from 'node:module';
test('ECC L1: report scrub covers refresh tokens and client secrets', () => { const t = scrub('1//' + 'a'.repeat(30) + ' GOCSPX-' + 'b'.repeat(20)); assert.ok(!/1\/\/a|GOCSPX-b/.test(t), t); });
test('ECC M5/L3: importer and AI host checks refuse private, CGNAT and mapped IPv6 hosts', () => {
  const g = createRequire(import.meta.url)('../electron/net-guard.cjs');
  for (const u of ['http://172.20.0.1/x', 'http://0.0.0.0/', 'http://[::1]/', 'https://printer.local/', 'http://100.64.1.1/', 'file:///etc/passwd', 'https://u:p@example.com/']) assert.ok(!g.publicUrlAllowed(new URL(u)), u);
  assert.ok(g.publicUrlAllowed(new URL('https://example.com/paper.pdf'))); assert.ok(!g.aiUrlAllowed(new URL('https://[::ffff:7f00:1]/v1'))); assert.ok(!g.aiUrlAllowed(new URL('https://100.100.1.1/v1')));
});
