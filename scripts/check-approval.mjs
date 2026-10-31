// 0.9.10 release gate: exits 0 only when the owner approved this exact version + build in the Developer panel.
// Usage: node scripts/check-approval.mjs [version] [buildId]   (defaults: package.json version, git HEAD short=12)
// The proxy URL comes from PRVLAR_PROXY or .env.production (VITE_PRVLAR_PROXY). Used by the release workflow and the monthly routine.
import { readFileSync } from 'node:fs'; import { execSync } from 'node:child_process';
const version = process.argv[2] || JSON.parse(readFileSync('package.json', 'utf8')).version;
const build = process.argv[3] || process.env.PRVLAR_BUILD_ID || execSync('git rev-parse --short=12 HEAD').toString().trim();
let url = process.env.PRVLAR_PROXY || ''; if (!url) { try { url = (readFileSync('.env.production', 'utf8').match(/^VITE_PRVLAR_PROXY=(.*)$/m) || [])[1]?.trim() || ''; } catch { /* none */ } }
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) { console.error('No proxy URL configured; cannot check approval.'); process.exit(2); }
const q = `${url}?action=approval&version=${encodeURIComponent(version)}&build=${encodeURIComponent(build)}`;
let j = {}; try { const r = await fetch(q, { redirect: 'follow' }); j = (await r.json()).body || {}; } catch (e) { console.error('Approval check failed: ' + e.message); process.exit(2); }
if (j.approved === true) { console.log(`APPROVED ${version} build ${build} at ${j.at}`); process.exit(0); }
console.log(`NOT APPROVED: ${version} build ${build}`); process.exit(1);
