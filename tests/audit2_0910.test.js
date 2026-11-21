// 0.9.10 logic audit part 2 regressions (import headings, numeric/letter answers, spaced repetition labels,
// error log without marks, negative percent, neutral AI provider wording).
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { splitSections } from '../src/structure.js';
import { scoreQuestion, readNumber } from '../src/examprofile.js';
import { preview } from '../src/srs.js';
import { errorEntries } from '../src/progress.js';
import { makeAttempt } from '../src/engine.js';
const read = f => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');

test('TXT import: a numbered list is not split into chapters; real numbered headings still are', () => {
  assert.deepEqual(splitSections('Intro\n\n1. Newton was a Scientist\n2. Einstein Developed relativity\nbody').map(s => s.title), ['Intro']);
  assert.deepEqual(splitSections('1 Motion\nBodies move when a force acts on them.\n\n2 Energy\nEnergy is conserved in a closed system.').map(s => s.title), ['1 Motion', '2 Energy']);
  assert.deepEqual(splitSections('1 Motion\n1.1 Speed\nSpeed is distance over time.').map(s => s.title), ['1 Motion', '1.1 Speed']);
});
test('TXT import: a one-word reply or a line answering a question is not a heading', () => {
  const t = splitSections('Q: What is X?\n\nYes\n\nIt is a long answer sentence that explains everything.').map(s => s.title);
  assert.ok(!t.includes('Yes'), JSON.stringify(t));
  assert.deepEqual(splitSections('Newton laws\n\nAn object stays at rest unless acted on by a force.').map(s => s.title), ['Newton laws']);
});
test('numerical answers: thousands separators (Western and Indian) and fractions are read; unreadable = blank', () => {
  const q = { type: 'numerical', answer: 1000, marks: 4, negative: 1 };
  for (const a of ['1000', '1,000', '1 000', '1000.0']) assert.equal(scoreQuestion(q, a), 4, a);
  assert.equal(scoreQuestion({ ...q, answer: 100000 }, '1,00,000'), 4);
  assert.equal(scoreQuestion({ ...q, answer: 0.5 }, '1/2'), 4);
  assert.equal(scoreQuestion(q, '999'), -1);
  assert.equal(scoreQuestion(q, 'abc'), 0); assert.equal(scoreQuestion(q, '12,34'), 0);
  assert.ok(Number.isNaN(readNumber('1/0')));
});
test('multi-correct answers given as letters score like indices', () => {
  const q = { type: 'multi', correct: [0, 1], marks: 4, negative: 2 };
  assert.equal(scoreQuestion(q, 'A,B'), 4); assert.equal(scoreQuestion(q, 'a, b'), 4); assert.equal(scoreQuestion(q, [0, 1]), 4);
  assert.equal(scoreQuestion(q, 'A,C'), -2); assert.equal(scoreQuestion(q, 'A,?'), 0);
});
test('spaced repetition: Hard and Good differ for a new card; next-day due shows days, not hours', () => {
  const now = Date.parse('2026-11-01T23:30:00+05:30');
  const p = Object.fromEntries(preview({ id: 1, due: 0, interval: 0, ease: 2.5, reps: 0, lapses: 0 }, now).map(g => [g.label, g.label2]));
  assert.equal(p.Hard, '1d'); assert.equal(p.Good, '2d'); assert.equal(p.Again, '10m');
});
test('error log: a question without marks is not listed when it got its mark', () => {
  const a = { id: 'a', questions: [{ id: 'q1' }], grades: [{ id: 'q1', awarded: 1, method: 'auto' }] };
  assert.equal(errorEntries([a]).length, 0);
  assert.equal(errorEntries([{ ...a, grades: [{ id: 'q1', awarded: 0, method: 'auto' }] }]).length, 1);
});
test('negative marking: percent never goes below 0 (same rule as manual re-marking)', () => {
  const r = makeAttempt('d', [{ id: 'q', marks: 4 }], {}, 0, 1, [{ id: 'q', awarded: -1, method: 'auto' }]);
  assert.equal(r.earned, -1); assert.equal(r.percent, 0);
});
test('re-marking validates every field before changing any grade', () => {
  const m = read('main.js'), adj = m.slice(m.indexOf('async adjust()'), m.indexOf('reset() {', m.indexOf('async adjust()')));
  assert.ok(adj.indexOf('edits.push') > 0 && adj.indexOf('edits.push') < adj.indexOf('g.awarded = n'));
  assert.match(adj, /if \(!q \|\| !g\) continue;/);
});
test('focus minutes and the test average never show NaN', () => {
  const m = read('main.js');
  assert.ok(!/reduce\(\(a, s\) => a \+ s\.minutes, 0\)/.test(m)); assert.ok(!/a \+ x\.percent/.test(m));
  assert.match(m, /function ringSVG\(p[^)]*\) \{\n {2}p = pctOf/);
});
test('no other companies’ AI product names in user-visible text (settings, onboarding, legal, attachments)', () => {
  const NAMES = /\b(Gemini|Gemma|Groq|OpenAI|ChatGPT|Claude|Anthropic|Copilot|OmniRoute|LiteRT|Llama|Mistral|DeepSeek|Perplexity)\b/;
  const strip = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // user-visible strings: quoted or template text with a space in it (identifiers, model ids and URLs have none)
  const visible = s => (strip(s).match(/(['`])(?:(?!\1)[^\\\n]|\\.)*\s(?:(?!\1)[^\\\n]|\\.)*\1/g) || []).filter(x => !/https?:\/\//.test(x) || /\s\w+\s/.test(x));
  for (const f of ['legal.js', 'attach.js']) assert.ok(!NAMES.test(strip(read(f))), f);
  const bad = ['main.js', 'ai.js'].flatMap(f => visible(read(f)).filter(x => NAMES.test(x.replace(/https?:\/\/\S+/g, '')) && !/(startsWith|test\(|model|endpoint|\bid\b|order|fb\.|state\.)/.test(x)).map(x => f + ': ' + x.slice(0, 120)));
  assert.deepEqual(bad, []);
});
