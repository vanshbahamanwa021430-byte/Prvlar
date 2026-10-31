// 18+ confirmation (0.9.10). Before online AI, Google sign-in/cloud features and problem reports, the user ticks
// "I'm 18 or older". Only the confirmation flag and the date it was confirmed are stored; no date of birth.
// This is a self-declaration: it does not verify identity and is not parental consent.
const KEY = 'prvlar-age';
const read = store => { try { return JSON.parse(store.getItem(KEY) || 'null'); } catch { return null; } };
// Older 0.9.9 records ({result, checked}) are converted once: 'adult' keeps its date, anything else is cleared.
export function migrateAge(store = localStorage) {
  const v = read(store); if (!v || 'confirmed' in v) return;
  if (v.result === 'adult') store.setItem(KEY, JSON.stringify({ confirmed: true, at: String(v.checked || '').slice(0, 10) }));
  else store.removeItem(KEY);
}
export function confirmAdult(store = localStorage, today = new Date()) {
  const at = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;   // local date
  store.setItem(KEY, JSON.stringify({ confirmed: true, at }));
  return 'adult';
}
export function clearAdult(store = localStorage) { store.removeItem(KEY); }
export function ageStatus(store = localStorage) { migrateAge(store); const v = read(store); return v && v.confirmed === true ? 'adult' : 'unknown'; }
export const isAdult = (store = localStorage) => ageStatus(store) === 'adult';
export const confirmedOn = (store = localStorage) => (isAdult(store) && read(store).at) || '';
