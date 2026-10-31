// 0.9.10: "Report AI answer" reaches the owner. The sanitised report (category, note, answer excerpt, question excerpt,
// kind, app version, random id; never an email or a whole document) is sent to the Prvlar proxy ('report' action),
// which appends it to the owner's Google Sheet and emails the owner. Reports are queued offline and retried; the
// local copy is always kept. The owner's Developer panel fetches all reports with 'listReports' (ID-token verified).
import { listReports, scrub } from './aireport.js';
const QKEY = 'prvlar-report-queue', SKEY = 'prvlar-report-sent';
const rd = (s, k) => { try { const v = JSON.parse(s.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
export const queued = (store = localStorage) => rd(store, QKEY);
export const wasSent = (id, store = localStorage) => rd(store, SKEY).includes(id);
export function enqueue(id, store = localStorage) { const q = queued(store); if (!q.includes(id)) q.push(id); store.setItem(QKEY, JSON.stringify(q.slice(-100))); }
export function wirePayload(r) {
  return { id: String(r.id).slice(0, 64), category: r.category, kind: String(r.kind || '').slice(0, 20), version: String(r.version || '').slice(0, 20),
    note: scrub(String(r.note || '')).slice(0, 500), answer: scrub(String(r.answer || '')).slice(0, 1500), question: scrub(String(r.context || '')).slice(0, 300), at: r.at };
}
// send(action, data) -> { status, body }. Returns { sent, left }.
export async function flushReports(send, store = localStorage) {
  const q = queued(store); if (!q.length) return { sent: 0, left: 0 };
  const all = listReports(store), left = []; let sent = 0, stop = false;
  for (const id of q) {
    const r = all.find(x => x.id === id); if (!r) continue;
    if (stop) { left.push(id); continue; }
    const res = await send('report', wirePayload(r)).catch(() => ({ status: 0 }));
    if (res.status === 200) { sent++; const s = rd(store, SKEY); s.push(id); store.setItem(SKEY, JSON.stringify(s.slice(-300))); }
    else if (res.status === 400 || res.status === 403) { /* refused for good (bad data / not eligible): keep locally only */ }
    else { left.push(id); stop = true; }   // offline, busy or rate-limited: try again later, in order
  }
  store.setItem(QKEY, JSON.stringify(left)); return { sent, left: left.length };
}
// Retry with backoff: 30 s, 1, 2, 4 … up to 30 minutes; also when the device comes back online.
export function startRetry(send, { store = localStorage, onChange = () => {}, win = globalThis } = {}) {
  let delay = 30000, timer = null;
  const run = async () => { clearTimeout(timer); const r = await flushReports(send, store); if (r.sent) onChange(r); if (r.left) { timer = setTimeout(run, delay); delay = Math.min(delay * 2, 1800000); } else delay = 30000; return r; };
  win.addEventListener?.('online', run);
  return run;
}
export async function fetchOwnerReports(send) {
  const r = await send('listReports', {}, true);
  if (r.status !== 200) throw Error(r.body?.error?.message || 'Could not load reports (' + r.status + ').');
  return Array.isArray(r.body.reports) ? r.body.reports : [];
}
