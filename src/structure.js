// Pure helpers (no DOM, no third-party imports) so they can be unit-tested in Node.
const MD = /^(#{1,6})\s+(\S.*)$/;

export function headingOf(line, markdownOnly = false) {
  const t = line.trim();
  if (!t || t.length > 90) return null;
  const m = t.match(MD);
  if (m) return { level: m[1].length, title: m[2].replace(/\s#+\s*$/, '').trim() };
  if (markdownOnly) return null;
  const n = t.match(/^(\d+(?:\.\d+){0,3})[.)]?\s+([A-Z].{2,}[^.:;,!?])$/);
  if (n && t.length <= 80) return { level: n[1].split('.').length, title: t };
  if (/^(chapter|unit|part|section|module|lesson)\s+[\w.-]+/i.test(t) && t.length <= 80 && !/[.!?]$/.test(t)) return { level: 1, title: t };
  if (t.length >= 4 && t.length <= 60 && /^[A-Z][A-Z0-9 ,:&'’()\/-]+$/.test(t) && /[A-Z]{3}/.test(t)) return { level: 2, title: t };
  return null;
}

function uniqueRef(title, seen) {
  const base = title.slice(0, 75);
  const n = (seen.get(base) || 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base} (${n})`;
}

// Splits plain/markdown text into sections by headings. With no headings, groups lines into "Part N" chunks.
export function splitSections(text, { maxPart = 1800 } = {}) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const markdownOnly = lines.some(l => MD.test(l.trim()));
  const seen = new Map();
  const out = [];
  let cur = null, headings = 0;
  const open = (title, level) => { cur = { ref: uniqueRef(title, seen), title: title.slice(0, 75), level, text: '' }; out.push(cur); };
  // 0.9.10: a short title-like line on its own (blank line before it or start of file, and a blank line or a longer
  // sentence after it) is a heading too, e.g. "Newton laws" at the top of a plain-text note.
  const titleLike = t => t.length >= 2 && t.length <= 60 && t.split(/\s+/).length <= 8 && /^\p{Lu}/u.test(t) && !/[.,;:!?…]$/.test(t) && !/^[-*•]/.test(t);
  const plainHead = i => {
    if (markdownOnly) return null;
    const t = lines[i].trim(); if (!titleLike(t)) return null;
    const prev = i === 0 ? '' : lines[i - 1].trim(); if (prev) return null;
    const next = (lines[i + 1] || '').trim(), after = lines.slice(i + 1).map(x => x.trim()).find(Boolean) || '';
    if (!after) return null;
    return !next || (next.length >= Math.max(30, t.length * 2) && /[.!?]$/.test(next)) ? { level: 1, title: t } : null;
  };
  for (const [i, line] of lines.entries()) {
    const h = headingOf(line, markdownOnly) || plainHead(i);
    if (h) { headings++; open(h.title, h.level); continue; }
    const t = line.trim();
    if (!t) { if (cur && cur.text && !cur.text.endsWith('\n\n')) cur.text += '\n'; continue; }
    if (!cur) open('Introduction', 1);
    cur.text += t + '\n';
  }
  if (headings === 0) {
    const parts = [], buf = [];
    let size = 0;
    const flush = () => { if (buf.length) { parts.push(buf.join('\n')); buf.length = 0; size = 0; } };
    for (const l of lines.map(x => x.trim()).filter(Boolean)) { buf.push(l); size += l.length; if (size >= maxPart) flush(); }
    flush();
    const s2 = new Map();
    return parts.map((p, i) => ({ ref: uniqueRef('Part ' + (i + 1), s2), title: `Part ${i + 1}: ${(p.split('\n')[0] || '').trim().slice(0, 60)}`.slice(0, 75), level: 1, text: p }));
  }
  return out.map(s => ({ ...s, text: s.text.trim() }));
}

const firstLine = t => (String(t).split('\n').find(l => l.trim()) || '').trim();

// Builds a tree from flat sections using their heading level. Works with older stored docs that only have {ref,text}.
export function outline(doc) {
  const nodes = [{ id: 'root', title: doc.name, source: '', text: '', parent: null, depth: 0 }];
  const stack = [{ level: 0, id: 'root', depth: 0 }];
  doc.sections.forEach((s, i) => {
    const level = s.level || 1;
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1];
    const id = 's' + i, depth = parent.depth + 1;
    nodes.push({ id, title: (s.title || firstLine(s.text) || s.ref).slice(0, 75), source: s.ref, text: s.text, parent: parent.id, depth });
    stack.push({ level, id, depth });
  });
  return nodes;
}

// Sections from older saves, imports or merged documents can miss ref/title or carry non-string text: normalise them.
export function usableSections(doc) {
  const list = Array.isArray(doc?.sections) ? doc.sections : [];
  return list.filter(s => s && typeof s.text === 'string' && s.text).map((s, i) => ({ ...s, ref: String(s.ref || s.title || 'Section ' + (i + 1)) }));
}

export function contextInfo(doc, limit = 22000) {
  const secs = usableSections(doc);
  const total = secs.reduce((a, s) => a + s.text.length + s.ref.length + 4, 0);
  return { total, used: Math.min(total, limit), truncated: total > limit };
}

// Text sent to the AI. If the document is too long, sample evenly across sections instead of cutting off the tail.
export function sourceContext(doc, limit = 22000) {
  let secs = usableSections(doc);
  const full = secs.map(s => `[${s.ref}]\n${s.text}`).join('\n\n');
  if (full.length <= limit) return full;
  const minEach = 200;
  if (secs.length * minEach > limit) { const step = Math.ceil(secs.length * minEach / limit); secs = secs.filter((_, i) => i % step === 0); }
  const each = Math.max(minEach, Math.floor(limit / secs.length));
  return secs.map(s => `[${s.ref}]\n${s.text.slice(0, Math.max(60, each - s.ref.length - 4))}`).join('\n\n').slice(0, limit);
}

// Soft check: flags questions whose source label doesn't match any section of the document.
export function verifySources(doc, questions) {
  const refs = usableSections(doc).map(s => s.ref.toLowerCase());
  return (questions || []).map(q => ({ ...q, sourceVerified: refs.some(r => String(q.source || '').toLowerCase().includes(r)) }));
}
