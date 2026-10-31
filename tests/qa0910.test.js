// 0.9.10 web QA regressions: PDF split by headings, TXT title line, Part titles.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { pdfHeadingSections } from '../src/pdflayout.js';
import { splitSections } from '../src/structure.js';
test('PDF with larger heading lines is split by heading, not "Page 1"', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(new URL('./fixtures/qa-headings.pdf', import.meta.url))), disableFontFace: true, useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) { const c = await (await pdf.getPage(i)).getTextContent(); const lines = []; let cur = { text: '', size: 0 }; for (const it of c.items) { cur.text += it.str; if (it.str.trim()) cur.size = Math.max(cur.size, Math.abs(it.height)); if (it.hasEOL) { lines.push(cur); cur = { text: '', size: 0 }; } } if (cur.text.trim()) lines.push(cur); pages.push({ n: i, lines }); }
  const s = pdfHeadingSections(pages);
  assert.deepEqual(s.map(x => x.ref), ['Photosynthesis', 'Light reactions', 'Calvin cycle']);
  assert.equal(s[0].level, 1); assert.equal(s[1].level, 2); assert.match(s[2].text, /stroma/); assert.equal(s[0].page, 1);
  await pdf.destroy();
});
test('PDF without headings keeps per-page sections (null)', () => {
  assert.equal(pdfHeadingSections([{ n: 1, lines: [{ text: 'Just body text here.', size: 12 }, { text: 'More body', size: 12 }] }]), null);
});
test('TXT: a title line is its own heading, not merged into the text', () => {
  const s = splitSections(readFileSync(new URL('./fixtures/qa-note.txt', import.meta.url), 'utf8'));
  assert.equal(s.length, 1); assert.equal(s[0].ref, 'Newton laws'); assert.match(s[0].text, /^First law: an object stays at rest/);
});
test('TXT without headings: Part title is the first line, not words from two lines', () => {
  const s = splitSections('first line of the note here.\nsecond line continues.');
  assert.equal(s[0].title, 'Part 1: first line of the note here.');
});
test('prose lines are not mistaken for headings', () => {
  const s = splitSections('Intro paragraph that is long enough to be prose, clearly.\n\nShort remark\nThis sentence follows directly without a blank line, fine.');
  assert.ok(!s.some(x => x.ref === 'Intro paragraph that is long enough to be prose, clearly.'));
});
