/**
 * Prvlar free AI proxy — Google Apps Script web app (Execute as: Me, Who has access: Anyone).
 * Holds the owner's Gemini key in Script Properties and forwards chat requests from the Prvlar app to Gemini.
 * Stores only daily/minute counters (hashed device or account ids). No message text, key or token is stored in logs.
 *
 * One-time setup (see DEPLOY.md):
 *   1. Paste the Gemini key between the quotes in SETUP_GEMINI_KEY, run setup(), then clear it again and save.
 *   2. Read APP_TOKEN in Project Settings › Script properties and put it in the app's config (it is public; it only filters casual misuse).
 *   4. 0.9.10 reports + release approvals: set OWNER_EMAILS (default vanshbahamanwa021430@gmail.com). A Google Sheet is
 *      created on first use (id kept in REPORT_SHEET_ID). Needs ALLOWED_AUD for owner-only actions. Redeploy after authorising
 *      the new Spreadsheet and Mail permissions.
 *   3. Optional: set ALLOWED_AUD (comma-separated OAuth client IDs) so requests carrying a Google ID token are limited per account.
 */
var SETUP_GEMINI_KEY = '';            // paste ONLY for the one setup() run, then delete and save
var DEVICE_LIMIT = 30;                // messages per device (or verified Google account) per day
var GLOBAL_LIMIT = 1000;              // messages per day for everyone together
var ANON_LIMIT = 700;                 // of those, at most this many from unverified devices (device ids are client-made)
var MINUTE_LIMIT = 20;                // messages per minute for everyone together (stops one script draining the day)
var MAX_BODY = 12000000;              // only for requests with a picture or audio part
var MAX_TEXT_BODY = 400000;           // requests that are text only
var MAX_CHARS = 120000, MAX_TOKENS = 4096, MAX_MESSAGES = 40;
var ROLES = { system: 1, user: 1, assistant: 1 }, PARTS = { text: 1, image_url: 1, input_audio: 1 };
var MODEL = 'gemini-flash-latest';
var GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

function setup() {
  var p = PropertiesService.getScriptProperties();
  if (SETUP_GEMINI_KEY) p.setProperty('GEMINI_KEY', SETUP_GEMINI_KEY.trim());
  if (!p.getProperty('APP_TOKEN')) p.setProperty('APP_TOKEN', Utilities.getUuid());
  Logger.log('Gemini key stored: ' + (p.getProperty('GEMINI_KEY') ? 'yes' : 'NO — paste it into SETUP_GEMINI_KEY and run setup again'));
  Logger.log('APP TOKEN is set. Read it in Project Settings › Script properties (APP_TOKEN) and put it in the app config as freeToken.');
  Logger.log('Now clear SETUP_GEMINI_KEY, save, and deploy as a web app.');
}
/** Shows status without revealing the key. */
function status() {
  var p = PropertiesService.getScriptProperties();
  Logger.log(JSON.stringify({ keySet: !!p.getProperty('GEMINI_KEY'), tokenSet: !!p.getProperty('APP_TOKEN'), today: today_(), globalUsed: Number(p.getProperty('g:' + today_()) || 0) }));
}
/** Optional: run daily via a time trigger to remove old counters. */
function cleanup() {
  var p = PropertiesService.getScriptProperties(), all = p.getProperties(), t = today_();
  Object.keys(all).forEach(function (k) { if (/^(g|a|m|d):/.test(k) && k.indexOf(t) === -1) p.deleteProperty(k); });
}

function today_() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }
function hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 24); }
function out_(status, body) { return ContentService.createTextOutput(JSON.stringify({ status: status, body: body })).setMimeType(ContentService.MimeType.JSON); }
function err_(status, msg, code) { return out_(status, { error: { message: code ? code + ': ' + msg : msg, code: code || status } }); }

/** Masks every occurrence of the key (not only the first). */
function mask_(text, key) { return key ? String(text).split(key).join('***') : String(text); }
/** Checks the message list: known roles, string or known content parts, total text size. Returns '' or an error. */
function validate_(msgs) {
  var chars = 0, media = false;
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i];
    if (!m || typeof m !== 'object' || !ROLES[m.role]) return { error: 'Bad message role.' };
    if (typeof m.content === 'string') chars += m.content.length;
    else if (Array.isArray(m.content) && m.content.length <= 12) {
      for (var j = 0; j < m.content.length; j++) {
        var c = m.content[j];
        if (!c || !PARTS[c.type]) return { error: 'Unsupported message part.' };
        if (c.type === 'text') { if (typeof c.text !== 'string') return { error: 'Bad text part.' }; chars += c.text.length; }
        else if (c.type === 'image_url') { if (!c.image_url || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(String(c.image_url.url || ''))) return { error: 'Pictures must be sent inline.' }; media = true; }
        else { if (!c.input_audio || typeof c.input_audio.data !== 'string' || !/^(mp3|wav)$/.test(String(c.input_audio.format))) return { error: 'Bad audio part.' }; media = true; }
      }
    } else return { error: 'Bad message content.' };
  }
  if (chars > MAX_CHARS) return { error: 'Request too long for the free option. Use your own key for big documents.', code: 413 };
  return { media: media };
}
/** Optional: a Google ID token (from Sign in with Google) makes the daily limit per account instead of per device. */
function verifiedUser_(idToken) {
  if (!idToken) return '';
  var aud = String(PropertiesService.getScriptProperties().getProperty('ALLOWED_AUD') || '').split(',').filter(String);
  if (!aud.length) return '';
  try {
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return '';
    var t = JSON.parse(r.getContentText());
    if (aud.indexOf(t.aud) === -1 || String(t.email_verified) !== 'true' || Number(t.exp) * 1000 < Date.now()) return '';
    return 'u:' + t.sub;
  } catch (x) { return ''; }
}

/* ---------- 0.9.10: AI answer reports and release approvals ---------- */
var OWNER_DEFAULT = 'vanshbahamanwa021430@gmail.com';
var REPORT_DEVICE_DAY = 10, REPORT_GLOBAL_DAY = 200, REPORT_MAIL_DAY = 50;
var CATS = { inaccurate: 1, harmful: 1, inappropriate: 1, 'privacy': 1 };
function clean_(t, n) {
  return String(t == null ? '' : t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{10,}|sk-[A-Za-z0-9_-]{10,}|GOCSPX-[0-9A-Za-z_-]+|ya29\.[0-9A-Za-z_.-]+|1\/\/[0-9A-Za-z_-]{10,}/g, '[key]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]').replace(/\+?\d[\d\s().-]{8,}\d/g, '[phone]').slice(0, n);
}
function sheet_(name, header) {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('REPORT_SHEET_ID'), ss;
  if (id) ss = SpreadsheetApp.openById(id); else { ss = SpreadsheetApp.create('Prvlar reports and approvals'); p.setProperty('REPORT_SHEET_ID', ss.getId()); }
  var sh = ss.getSheetByName(name); if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); }
  return sh;
}
function owners_() { return String(PropertiesService.getScriptProperties().getProperty('OWNER_EMAILS') || OWNER_DEFAULT).toLowerCase().split(',').map(function (x) { return x.trim(); }).filter(String); }
/** Owner check: a valid Google ID token for an allowed client whose verified email is an owner. */
function ownerFromToken_(idToken) {
  var aud = String(PropertiesService.getScriptProperties().getProperty('ALLOWED_AUD') || '').split(',').filter(String);
  if (!idToken || !aud.length) return '';
  try {
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return '';
    var t = JSON.parse(r.getContentText()), em = String(t.email || '').toLowerCase();
    if (aud.indexOf(t.aud) === -1 || String(t.email_verified) !== 'true' || Number(t.exp) * 1000 < Date.now()) return '';
    return owners_().indexOf(em) !== -1 ? em : '';
  } catch (x) { return ''; }
}
function count_(p, k, max) { var n = Number(p.getProperty(k) || 0); if (n >= max) return false; p.setProperty(k, String(n + 1)); return true; }
function report_(req, p) {
  var d = req.data || {};
  if (!CATS[d.category]) return err_(400, 'Unknown report category.');
  var id = String(d.id || '').replace(/[^0-9A-Za-z-]/g, '').slice(0, 64); if (!id) return err_(400, 'Missing report id.');
  var answer = clean_(d.answer, 1500); if (!answer) return err_(400, 'Empty report.');
  var t = today_(), lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (x) { return err_(429, 'Busy, try again later.', 'PRVLAR_BUSY'); }
  try {
    if (!count_(p, 'r:' + t + ':' + hash_(String(req.device)), REPORT_DEVICE_DAY)) return err_(429, 'Too many reports from this device today.', 'PRVLAR_LIMIT');
    if (!count_(p, 'rg:' + t, REPORT_GLOBAL_DAY)) return err_(429, 'Too many reports today.', 'PRVLAR_LIMIT');
    var sh = sheet_('Reports', ['received', 'id', 'category', 'kind', 'version', 'reported at', 'answer', 'question', 'note']);
    var seen = sh.getRange(1, 2, Math.max(1, sh.getLastRow()), 1).getValues().some(function (r) { return r[0] === id; });
    if (seen) return out_(200, { ok: true, duplicate: true });
    var row = [new Date().toISOString(), id, d.category, clean_(d.kind, 20), clean_(d.version, 20), clean_(d.at, 30), answer, clean_(d.question, 300), clean_(d.note, 500)];
    sh.appendRow(row);
    if (count_(p, 'rm:' + t, REPORT_MAIL_DAY)) {
      try { MailApp.sendEmail(owners_()[0], 'Prvlar: AI answer reported (' + d.category + ')', 'Category: ' + d.category + '\nKind: ' + row[3] + '\nVersion: ' + row[4] + '\nReport id: ' + id + '\n\nAnswer (excerpt):\n' + answer + '\n\nQuestion (excerpt):\n' + row[7] + '\n\nNote:\n' + row[8] + '\n\nAll reports: the "Prvlar reports and approvals" Google Sheet, or Developer panel › Reports.'); } catch (x) { /* sheet row is the record */ }
    }
  } finally { lock.releaseLock(); }
  return out_(200, { ok: true });
}
function listReports_(req) {
  if (!ownerFromToken_(req.idToken)) return err_(403, 'Only the owner can read reports.', 'PRVLAR_OWNER');
  var sh = sheet_('Reports', ['received', 'id', 'category', 'kind', 'version', 'reported at', 'answer', 'question', 'note']);
  var v = sh.getDataRange().getValues().slice(1).slice(-500);
  return out_(200, { reports: v.map(function (r) { return { received: String(r[0]), id: r[1], category: r[2], kind: r[3], version: r[4], at: String(r[5]), answer: r[6], question: r[7], note: r[8] }; }) });
}
function approveRelease_(req) {
  var who = ownerFromToken_(req.idToken); if (!who) return err_(403, 'Only the owner can approve a release.', 'PRVLAR_OWNER');
  var d = req.data || {}, ver = String(d.version || ''), build = String(d.buildId || '');
  if (!/^\d+\.\d+\.\d+$/.test(ver) || !/^[0-9a-f]{7,40}$/.test(build)) return err_(400, 'Bad version or build id.');
  sheet_('Approvals', ['approved at', 'version', 'build', 'client time', 'by (hash)']).appendRow([new Date().toISOString(), ver, build, clean_(d.timestamp, 30), hash_(who).slice(0, 16)]);
  return out_(200, { ok: true, version: ver, buildId: build });
}
/** Public read endpoint: GET ?action=approval&version=0.9.10&build=abc123 → { approved, at }. Holds no personal data. */
function approval_(ver, build) {
  var p = PropertiesService.getScriptProperties(); if (!p.getProperty('REPORT_SHEET_ID')) return { approved: false };
  var v = sheet_('Approvals', ['approved at', 'version', 'build', 'client time', 'by (hash)']).getDataRange().getValues().slice(1);
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][1]) === ver && String(v[i][2]) === build) return { approved: true, at: String(v[i][0]), version: ver, buildId: build };
  return { approved: false, version: ver, buildId: build };
}

function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.action === 'approval') return out_(200, approval_(String(q.version || ''), String(q.build || ''))); return out_(200, { ok: true, service: 'prvlar-free-ai', configured: !!PropertiesService.getScriptProperties().getProperty('GEMINI_KEY') }); }

function doPost(e) {
  var p = PropertiesService.getScriptProperties();
  var key = p.getProperty('GEMINI_KEY'), token = p.getProperty('APP_TOKEN');
  var raw = (e && e.postData && e.postData.contents) || '';
  if (raw.length > MAX_BODY) return err_(413, 'Request too large for the free option. Use your own key for big documents.');
  var req; try { req = JSON.parse(raw); } catch (x) { return err_(400, 'Bad request.'); }
  if (!req || req.token !== token) return err_(403, 'This proxy only serves the Prvlar app.');
  if (!/^device-[0-9a-f-]{36}$/.test(String(req.device || ''))) return err_(400, 'Missing device id.');
  if (req.action === 'approveRelease') return approveRelease_(req);
  if (req.action === 'listReports') return listReports_(req);
  if (req.action === 'report') { if (req.eligible !== true) return err_(403, 'Reports need the 18+ confirmation.', 'PRVLAR_AGE'); if (raw.length > 20000) return err_(413, 'Report too large.'); return report_(req, p); }
  if (req.action) return err_(400, 'Unknown action.');
  if (!key) return err_(503, 'The free option is not set up yet.');
  // 0.9.9 compliance: server-side enforcement. The app sends eligible:true only after the 18+ confirmation;
  // a direct request without it is refused. When ALLOWED_AUD is set, a valid Google ID token is required as well.
  if (req.eligible !== true) return err_(403, 'Online AI is only for users aged 18 or over.', 'PRVLAR_AGE');
  var audSet = String(p.getProperty('ALLOWED_AUD') || '').split(',').filter(String).length > 0;
  var pl = req.payload || {};
  if (!Array.isArray(pl.messages) || !pl.messages.length || pl.messages.length > MAX_MESSAGES) return err_(400, 'Bad request.');
  var v = validate_(pl.messages);
  if (v.error) return err_(v.code || 400, v.error);
  if (!v.media && raw.length > MAX_TEXT_BODY) return err_(413, 'Request too large for the free option. Use your own key for big documents.');

  // Limits are keyed on a verified Google account when an ID token checks out, otherwise on the device id.
  // The client-supplied "account" field is ignored (0.9.8 review M1).
  var user = verifiedUser_(req.idToken);
  if (audSet && !user) return err_(401, 'Sign in with Google to use the free option.', 'PRVLAR_SIGNIN');
  var now = new Date(), t = today_(), gk = 'g:' + t, ak = 'a:' + t;
  var mk = 'm:' + Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd-HH-mm');
  var dk = 'd:' + t + ':' + hash_(user || String(req.device));
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (x) { return err_(429, 'The free option is busy right now. Try again in a minute.', 'PRVLAR_BUSY'); }
  try {
    var g = Number(p.getProperty(gk) || 0), n = Number(p.getProperty(dk) || 0), a = Number(p.getProperty(ak) || 0), m = Number(p.getProperty(mk) || 0);
    if (n >= DEVICE_LIMIT) return err_(429, 'You have used today’s free messages. Add your own free Gemini key in Settings › AI providers, or come back tomorrow.', 'PRVLAR_LIMIT');
    if (g >= GLOBAL_LIMIT || (!user && a >= ANON_LIMIT)) return err_(429, 'The free option is busy today. Add your own free Gemini key in Settings › AI providers.', 'PRVLAR_LIMIT');
    if (m >= MINUTE_LIMIT) return err_(429, 'The free option is busy right now. Try again in a minute.', 'PRVLAR_BUSY');
    p.setProperty(gk, String(g + 1)); p.setProperty(dk, String(n + 1)); p.setProperty(mk, String(m + 1));
    if (!user) p.setProperty(ak, String(a + 1));
  } finally { lock.releaseLock(); }

  var body = { model: MODEL, messages: pl.messages, max_tokens: Math.min(Number(pl.max_tokens) || MAX_TOKENS, MAX_TOKENS) };
  if (pl.response_format && pl.response_format.type === 'json_object') body.response_format = { type: 'json_object' };
  if (typeof pl.temperature === 'number') body.temperature = Math.max(0, Math.min(1, pl.temperature));
  var r = UrlFetchApp.fetch(GEMINI, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key }, payload: JSON.stringify(body), muteHttpExceptions: true });
  var code = r.getResponseCode(), text = r.getContentText();
  if (code === 429) return err_(429, 'The free option is busy right now. Try again in a minute, or add your own free Gemini key.', 'PRVLAR_BUSY');
  var json; try { json = JSON.parse(text); } catch (x) { return err_(502, 'Gemini returned an unreadable reply.'); }
  if (code >= 400) return err_(code, mask_(json.error && json.error.message || ('Gemini error ' + code), key));
  return out_(200, json);
}
