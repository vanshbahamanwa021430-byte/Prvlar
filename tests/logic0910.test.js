// 0.9.10 logic audit regressions.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { adjustPlan } from '../src/countdown.js';
import { pctOf, dayKey } from '../src/progress.js';
import { overlap } from '../src/keyboard.js';
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
test('planner: missed tasks are kept (not dropped) when the exam date has passed', () => {
  const plan = { examDate: '2026-10-20', adjusted: '2026-10-19', moved: 0, days: [{ date: '2026-10-18', tasks: [{ id: 'a', done: false }, { id: 'b', done: true }] }, { date: '2026-10-19', tasks: [{ id: 'c', done: false }] }] };
  const r = adjustPlan(plan, '2026-10-25');
  assert.deepEqual(r.days.flatMap(d => d.tasks.map(t => t.id)).sort(), ['a', 'b', 'c']); assert.equal(r.moved, 0);
});
test('planner: before the exam, missed tasks still move to open days', () => {
  const plan = { examDate: '2026-10-30', adjusted: '2026-10-19', moved: 0, days: [{ date: '2026-10-18', tasks: [{ id: 'a', done: false }] }, { date: '2026-10-25', tasks: [] }] };
  const r = adjustPlan(plan, '2026-10-25'); assert.equal(r.moved, 1); assert.ok(r.days.find(d => d.date === '2026-10-25').tasks.some(t => t.id === 'a'));
});
test('averages: attempts without a valid percent count as 0, never NaN', () => {
  const l = [{ percent: 80 }, {}, { percent: 'x' }, { percent: 140 }];
  const avg = Math.round(l.reduce((s, a) => s + pctOf(a), 0) / l.length); assert.equal(avg, 45); assert.ok(!main.includes('s + a.percent'));
});
test('backup file names use the local day (dayKey), not UTC', () => {
  assert.ok(!/prvlar-backup-' \+ new Date\(\)\.toISOString/.test(main)); assert.match(main, /'prvlar-backup-' \+ dayKey\(\)/);
  assert.equal(dayKey(new Date(2026, 10, 1, 0, 30).getTime()), '2026-11-01');
});
test('crash text no longer claims "Nothing is sent" without the auto-send exception', () => {
  assert.ok(!/Errors are kept only on this device, with keys and emails removed\. Nothing is sent\./.test(main));
  assert.match(main, /Nothing is sent unless “Send crash reports automatically”/);
  assert.match(readFileSync(new URL('../src/legal.js', import.meta.url), 'utf8'), /Nothing is sent unless you also turn on “Send crash reports automatically”/);
});
test('auto crash reports: disabled with a reason for unconfirmed users (no silent revert)', () => {
  assert.match(main, /id="rp-auto"[^\n]*disabled aria-describedby="rp-auto-why"/); assert.match(main, /Needs the 18\+ confirmation/);
});
test('no iOS app claims', () => { assert.ok(!/iOS 14|iPhone apps|coming soon on iPhone/.test(main)); });
test('toggles: visual state comes from :checked in CSS, with On/Off words', () => {
  assert.match(css, /input\[type="checkbox"\]:checked \+ \.switch \{/); assert.match(css, /content: 'On'/); assert.match(css, /content: 'Off'/);
  assert.match(main, /Off \(the default\): nothing is saved/); assert.match(main, /No crash reports saved\./);
});
test('onboarding never covers the Developer panel or legal pages', () => { assert.match(main, /\['dev', 'privacy', 'terms', 'about'\]\.includes\(state\.view\)\) return ''/); });
test('no other-provider names in the key help or the about page', () => {
  const kh = main.slice(main.indexOf('function keyHelpHTML'), main.indexOf('function viewSmarty')); assert.ok(!/Gemini|Groq/.test(kh.replace(/\/\/.*$/gm, '')));
  assert.ok(!/Gemini or Groq/.test(readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')));
});
test('settings 18+ row is a single checkbox (no DOB, no "Check again")', () => { assert.match(main, /data-pref099="age"/); const row = main.slice(main.indexOf('toggle-row age-row'), main.indexOf('toggle-row age-row') + 700); assert.ok(!/Check again/.test(row) && !/age-dob/.test(main)); });
test('keyboard overlap: visualViewport, native height without double-lift, small bars ignored', () => {
  assert.equal(overlap({ innerHeight: 800, vvHeight: 480 }), 320);
  assert.equal(overlap({ innerHeight: 800, vvHeight: 800, nativeKb: 300 }), 300);
  assert.equal(overlap({ innerHeight: 500, vvHeight: 500, nativeKb: 300, baseHeight: 800 }), 0);   // WebView already resized
  assert.equal(overlap({ innerHeight: 800, vvHeight: 760 }), 0);
  assert.match(css, /\.sheet \{ bottom: var\(--kb\)/);
});
