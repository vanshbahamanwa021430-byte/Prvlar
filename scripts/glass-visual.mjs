// 0.9.10 visual regression check for the Glass theme's photo background (regressed in 0.9.5, restored in 0.9.10).
// Renders the built app (npm run build && npx vite preview --port 4173) at phone and desktop size in the Glass theme and checks:
//  1. the bundled WebP photo is the background (fixed, cover), it loads and decodes;
//  2. the rendered page really shows the photo (it differs clearly from the same page with the photo blocked);
//  3. card text keeps WCAG AA contrast against the actual rendered pixels behind it (>= 4.5:1);
//  4. with the photo blocked, the solid/gradient fallback still renders readable text;
//  5. the screenshot matches the stored baseline (tests/visual/glass-*.png, compared at 1/4 size, so it may be stored downscaled) within tolerance.
// Usage: node scripts/glass-visual.mjs [url] [--update]   (PW_MODULE=/path/to/playwright/index.mjs if playwright-core is not installed)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const pw = await import('playwright-core').catch(() => import(process.env.PW_MODULE || 'playwright'));
const URL = process.argv.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:4173/', UPDATE = process.argv.includes('--update');
const BASE = new globalThis.URL('../tests/visual/', import.meta.url).pathname; mkdirSync(BASE, { recursive: true });
const exe = ['/usr/bin/google-chrome', process.env.CHROME].find(p => p && existsSync(p));
const browser = await pw.chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
const fails = [], log = (...a) => console.log(...a);
const seed = () => { localStorage.setItem('prvlar-entry', '"guest"'); localStorage.setItem('prvlar-onboarded', 'true'); localStorage.setItem('prvlar-theme', '"glass"'); };
// Pixel maths inside the page (canvas), so no PNG library is needed.
const stats = (page, b64, cmpB64, boxes) => page.evaluate(async ({ b64, cmpB64, boxes }) => {
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const px = (img, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
  const img = await load('data:image/png;base64,' + b64), W = img.naturalWidth, H = img.naturalHeight, sw = Math.round(W / 4), sh = Math.round(H / 4);
  const small = px(img, sw, sh); let s = 0, s2 = 0, n = 0; for (let i = 0; i < small.length; i += 4) { const g = (small[i] + small[i + 1] + small[i + 2]) / 3; s += g; s2 += g * g; n++; }
  const sd = Math.sqrt(s2 / n - (s / n) ** 2);
  let diff = null; if (cmpB64) { const ref = px(await load('data:image/png;base64,' + cmpB64), sw, sh); let d = 0; for (let i = 0; i < small.length; i += 4) d += (Math.abs(small[i] - ref[i]) + Math.abs(small[i + 1] - ref[i + 1]) + Math.abs(small[i + 2] - ref[i + 2])) / 3; diff = d / n; }
  const full = px(img, W, H), lum = (r, g, b) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  // For each text box: the brightest background pixel (worst case for light text) vs the text colour.
  const worst = boxes.map(b => { let max = 0; const dpr = W / innerWidth; for (let y = Math.round(b.y * dpr); y < Math.round((b.y + b.h) * dpr); y += 2) for (let x = Math.round(b.x * dpr); x < Math.round((b.x + b.w) * dpr); x += 2) { const i = (y * W + x) * 4; const L = lum(full[i], full[i + 1], full[i + 2]); if (L > max) max = L; }
    const [r, g, bl] = b.color; const T = lum(r, g, bl); return { sel: b.sel, ratio: +(((Math.max(T, max) + .05) / (Math.min(T, max) + .05))).toFixed(2) }; });
  return { sd: +sd.toFixed(1), diff: diff === null ? null : +diff.toFixed(1), worst };
}, { b64, cmpB64, boxes });
// Text boxes to check: card headings and paragraphs; measured as the padding strip around each text run (background only).
const textBoxes = page => page.evaluate(() => [...document.querySelectorAll('main .card h2, main .card .fine, main .card p')].filter(e => e.offsetParent && e.getBoundingClientRect().top > 0 && e.getBoundingClientRect().bottom < innerHeight).slice(0, 8).map(e => {
  const r = e.getBoundingClientRect(), c = getComputedStyle(e).color.match(/\d+(\.\d+)?/g).map(Number); return { sel: e.tagName + '.' + e.className, x: Math.max(0, r.left), y: Math.max(0, r.top - 3), w: Math.min(r.width, innerWidth - r.left), h: 3, color: c.slice(0, 3) }; }));
for (const [w, h, name] of [[390, 844, 'phone'], [1280, 800, 'desktop']]) {
  let photoShot = null;
  for (const blocked of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await ctx.addInitScript(seed); if (blocked) await ctx.route(/glass-bg-(phone|desktop)[^/]*\.webp/, r => r.abort());
    const p = await ctx.newPage(); await p.goto(URL + '#settings'); await p.waitForSelector('#intro', { state: 'detached', timeout: 15000 }).catch(() => {}); await p.waitForTimeout(1200);
    const tag = `${name}${blocked ? ' (photo blocked, fallback)' : ''}`;
    const css = await p.evaluate(() => { const b = getComputedStyle(document.body, '::before'); return { img: b.backgroundImage, pos: b.position, size: b.backgroundSize, theme: document.documentElement.dataset.theme }; });
    if (css.theme !== 'glass') fails.push(`${tag}: theme is ${css.theme}`);
    const want = w < 760 ? 'glass-bg-phone' : 'glass-bg-desktop';
    if (!blocked) {
      if (!css.img.includes(want)) fails.push(`${tag}: background is not ${want}: ${css.img.slice(0, 120)}`);
      if (css.pos !== 'fixed' || !/cover/.test(css.size)) fails.push(`${tag}: background not fixed/cover (${css.pos}, ${css.size})`);
      const ok = await p.evaluate(u => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth >= 700); i.onerror = () => res(false); i.src = u; }), (css.img.match(/url\("?([^")]+)"?\)/) || [])[1] || '');
      if (!ok) fails.push(`${tag}: photo does not load/decode`);
    }
    await p.evaluate(() => scrollTo(0, 0));
    const shot = (await p.screenshot()).toString('base64'), file = `${BASE}glass-${name}.png`;
    const ref = blocked ? photoShot : existsSync(file) && !UPDATE ? readFileSync(file).toString('base64') : null; if (!blocked) photoShot = shot;
    const s = await stats(p, shot, ref, await textBoxes(p));
    log(tag, JSON.stringify(s));
    if (!blocked && s.sd < 12) fails.push(`${tag}: page looks flat (pixel SD ${s.sd}), photo not visible`);
    if (blocked && !(s.diff >= 5)) fails.push(`${tag}: page looks the same with and without the photo (mean |Δ| ${s.diff}), so the photo is not showing`);
    for (const t of s.worst) if (t.ratio < 4.5) fails.push(`${tag}: contrast ${t.ratio}:1 for ${t.sel}`);
    if (!blocked && ref && s.diff > 18) fails.push(`${tag}: differs from baseline (mean |Δ| ${s.diff} > 18); run with --update only if the change is intended`);
    if (!blocked && (UPDATE || !existsSync(file))) { writeFileSync(file, Buffer.from(shot, 'base64')); log('baseline written', file); }
    await ctx.close();
  }
}
await browser.close();
if (fails.length) { console.error('GLASS VISUAL: FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('GLASS VISUAL: PASS');
