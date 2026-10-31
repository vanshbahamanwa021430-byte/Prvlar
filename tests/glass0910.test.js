// 0.9.10 regression guard: the glass theme's bundled photo background (lost in the 0.9.5 owner-pack split) must stay.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, statSync } from 'node:fs';
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const g = css.slice(css.indexOf('/* ===== 0.9.10: Glass photo background restored'));
test('glass: bundled phone + desktop WebP photo as a fixed cover background', () => {
  assert.ok(g.length > 100, 'section missing');
  assert.match(g, /--glass-default: url\('\.\/assets\/glass\/glass-bg-phone\.webp'\)/);
  assert.match(g, /min-width: 760px\) \{ :root\[data-theme="glass"\] \{ --glass-default: url\('\.\/assets\/glass\/glass-bg-desktop\.webp'\)/);
  assert.match(g, /var\(--glass-photo, var\(--glass-default\)\) center \/ cover no-repeat/);
  assert.match(css, /body::before \{ content: ''; position: fixed;/);
  for (const n of ['phone', 'desktop']) { const s = statSync(new URL(`../src/assets/glass/glass-bg-${n}.webp`, import.meta.url)).size; assert.ok(s > 20000 && s < 260000, n + ' ' + s); }
});
test('glass: 22px panels, fallbacks for no backdrop-filter, reduced transparency, lite devices, dark overlay', () => {
  assert.match(g, /blur\(22px\) saturate\(1\.25\)/);
  assert.match(g, /@supports not \(\(-webkit-backdrop-filter: blur\(1px\)\) or \(backdrop-filter: blur\(1px\)\)\)/);
  assert.match(g, /prefers-reduced-transparency: reduce[\s\S]*backdrop-filter: none !important/);
  assert.match(g, /html\.lite\[data-theme="glass"\]/); assert.match(g, /prefers-color-scheme: dark/); assert.match(g, /prefers-reduced-motion/);
});
test('glass: text contrast stays AA over the brightest photo pixels (veil + card surface)', () => {
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const over = (top, a, bot) => top.map((c, i) => c * a + bot[i] * (1 - a));
  const white = [255, 255, 255], veil = over([5, 20, 14], .48, white), card = over([8, 28, 20], .5, veil), ink = [0xF4, 0xFA, 0xF6];
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  assert.ok(cr(ink, card) >= 4.5, 'contrast ' + cr(ink, card).toFixed(2));
});
