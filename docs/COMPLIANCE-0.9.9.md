# 0.9.9 compliance hotfix: what was built, and the limits
- **Age eligibility** (src/age.js, 0.9.10): a single “I’m 18 or older” checkbox is shown before online AI, Google sign-in/cloud features and problem reports; only `{confirmed: true, at: date}` is stored (`prvlar-age`). No date of birth is asked or kept; the 0.9.9 DOB screen and DOB-based eligibility logic were removed (old `adult` records are converted, others cleared). Offline features never need it. **This is a self-declaration. It is not verifiable parental consent (DPDP s.9 / Rule 10) and does not by itself satisfy the Gemini API terms (18+ and not directed at minors).** A provider/terms decision is still required (see BETA-PLAN.md blockers).
- **Server enforcement** (proxy/apps-script/Code.gs): requests without `eligible:true` get 403 PRVLAR_AGE; when `ALLOWED_AUD` is set, requests without a valid Google ID token get 401. The flag is client-asserted; with ALLOWED_AUD it is tied to a verified Google account. Android has no ID token yet, so with ALLOWED_AUD set the free option needs a web/desktop sign-in or the user's own key.
- **Report AI answer** (src/aireport.js): on every Smarty reply and every AI-provisional mark; categories inaccurate/harmful/inappropriate/privacy + note; stores the answer (≤4000 chars) and a ≤300-char context excerpt, scrubbed of keys, tokens, emails and phone numbers. Kept on the device; Developer panel › AI reports (owner and co-developer only) has status new/reviewing/resolved, an audit trail and export.
- **Accuracy notice** under Smarty answers, Smarty-everywhere results and AI marks.
- **Privacy page** corrected: 0.9.9 sends no automatic crash/error reports (the public build has no report URL; automatic reports are now opt-in and adults-only even when one is configured). Data locations, retention, and the grievance contact vanshbahamanwa021430@gmail.com.
- **Deletion**: Delete cloud data also deletes AI reports, crash logs and the report send-history on the device.

## Evidence register (code at efc6b6a; screenshots in /workspace/out/test-0.9.9/)
| Control | Code | Test | Screenshot |
|---|---|---|---|
| 18+ confirmation (flag + date only, no DOB) | src/age.js; src/main.js requireAdult / ageConfirm | tests/hotfix0910.test.js; fulltest "Age" | 75-age-check.png |
| Gate: online AI / sign-in / reports need the confirmation (AI consent check H1 unchanged) | src/main.js requireAdult, aiAllowedQuiet; src/aigate.js | fulltest "Age – not confirmed" (no network request made) | 76-age-minor.png |
| Server rejects requests without the client's eligibility assertion | proxy/apps-script/Code.gs:96 | tests/proxygas098.test.js "direct proxy request without the eligibility flag" | – |
| Proxy requires ID token when ALLOWED_AUD set | proxy/apps-script/Code.gs:107 | tests/proxygas098.test.js "ALLOWED_AUD" | – |
| App sends eligibility flag | src/ai.js:54; src/main.js:3276 | tests/idtoken099.test.js | – |
| Proxy stores no content | proxy/apps-script/Code.gs (counts only) | tests/proxygas098.test.js "stores no message content" | – |
| Report AI answer (Smarty, AI marks) | src/main.js:2293, 1091; src/aireport.js | compliance099 test; fulltest "Report AI answer" (real answer, scrub verified) | 77-report-answer.png |
| Report scrub (keys, tokens, emails, phones, ≤300-char context) | src/aireport.js:6 | compliance099 test + fulltest | – |
| Reports tab: owner + co-dev only, status, audit, export | src/main.js:2364; src/devlog.js:55 | fulltest "AI reports", codev/tester role steps | 79-dev-reports.png |
| Accuracy notice | src/main.js:232 | fulltest "Report AI answer" (text asserted) | 77-report-answer.png |
| Privacy page matches code | src/legal.js:11, 13, 26 | fulltest "Privacy page" | 78-privacy.png |
| Automatic reports opt-in, adults only | src/main.js:2250 | – (no report URL in public build) | – |
| Deletion also clears reports and crash logs | src/main.js:2598 | fulltest "Deletion" | – |

## Install tests
| Test | Status |
|---|---|
| Real-device Android install (update over 0.9.8) | **NOT YET RUN**: owner will verify after release. Only static checks were done: signature certificate matches 0.9.8, versionName 0.9.9, versionCode 100909. |
| Windows install (setup exe + portable zip) | **NOT YET RUN**: owner will verify after release. |

## 0.9.10 additions
| Item | Code | Test | Evidence |
|---|---|---|---|
| AI answer reports sent to the owner (sanitised: category, note, answer ≤1500, question ≤300, version, random id; no email/account, no whole document), offline queue + retry, local copy kept | src/reportsync.js; src/ai.js proxyAction; proxy Code.gs report_ | tests/reports0910.test.js; fulltest "Report AI answer" | – |
| Proxy: report rate limits (10/device/day, 200/day, ≤50 emails/day); owner-only listReports / approveRelease via verified ID token | proxy/apps-script/Code.gs | tests/reports0910.test.js | – |
| Release approval gate (exact version + build) | src/main.js relApprove; scripts/check-approval.mjs; .github/workflows/promote.yml | tests/reports0910.test.js | – |
| **Proxy redeploy required** for reports and approvals (see proxy/apps-script/DEPLOY.md, "0.9.10 update") | – | – | NOT YET DEPLOYED |
