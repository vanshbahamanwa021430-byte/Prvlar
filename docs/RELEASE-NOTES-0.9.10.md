# Prvlar 0.9.10 (hotfix for 0.9.9) — PRE-RELEASE

This build is a pre-release for the owner to test on a phone. It becomes the latest release only after the owner
approves this exact version and build in Developer panel › Release approval.

## Android
- Reminders no longer fail with "LocalNotifications.then() is not implemented" (the plugin is never awaited as a promise).
- Documents whose sections have no label (older saves, imports or merged documents) no longer crash AI features or the context size check ("reduce of undefined" / ".length of undefined").
- The on-screen keyboard no longer covers the Smarty box or other inputs: adjustResize, Capacitor Keyboard resize "native", a visualViewport listener that lifts bottom bars and sheets, 100dvh layout and scrollIntoView on focus.
- A failed reminder-permission check can no longer stop start-up from finishing.

## Speed (lag)
- Reminder permission checks no longer hold up start-up.
- Low-memory devices: PDF reader and code editor load on first use; live background blur is replaced by solid surfaces (same layout and features).
- Opening the menu no longer renders the whole screen twice.
- The zip reader (XLSX attachments) and the OCR loader now load on first use, so the start-up bundle is 117 KB (13%) smaller.

## Age check
- The date-of-birth screen is replaced by one "I'm 18 or older" checkbox, asked only before online AI, Google sign-in/cloud features and problem reports. Offline features never need it. Only the confirmation and its date are stored; it can be withdrawn in Settings.
- Ticking "Send crash reports automatically" without the 18+ confirmation now asks for it instead of silently switching back off.

## Reports and release approval
- "Report AI answer" reaches the developer through the Prvlar proxy (a cleaned-up report, never an email or a whole document), which adds it to the owner's Google Sheet and emails the owner. Offline reports are queued and retried; a copy stays on the device. If sending is not switched on in a build, the app now says so instead of "will be sent when you are back online".
- Owner: Developer panel › Release approval shows the installed version and build with a "Confirm and approve release" button. Builds stay pre-release until the owner approves that exact build.
- The proxy (Apps Script) must be updated and redeployed once (proxy/apps-script/DEPLOY.md).

## Look
- Glass theme: the blossom photo background is back (it was lost in the 0.9.5 owner-pack split), as an optimised WebP for phone and desktop, with frosted 22 px cards, a dark veil for AA text contrast, and a solid fallback when the photo or blur is unavailable. A visual regression check (npm run test:visual) guards it.
- Toggle switches follow the checkbox state with CSS, so they never show the wrong state.
- The welcome/onboarding overlay no longer covers the Developer panel.

## Imports
- PDF: headings split the document into sections; the page count no longer shows "0 pages".
- TXT: the first line becomes the title heading instead of "Part 1: …" with "0 sections"; numbered lists ("1. …", "2. …") are no longer turned into chapters; a one-word reply such as "Yes" is not a heading.
- Delete all data is available when signed out.

## Tests and marks
- Numerical answers written as "1,000", "1,00,000" or "1/2" are accepted; an answer that cannot be read counts as blank (0), not wrong (negative marks).
- Multi-correct answers typed as letters ("A,B") are marked correctly.
- The percentage never goes below 0% (same rule everywhere), and re-marking checks every field before changing any mark.
- No more "NaN%" in averages, rings, focus minutes or the weekly report.
- Flashcards: Hard (1 day) and Good (2 days) now differ for a new card, and anything due on a later day is labelled in days, not hours.
- Error log: questions without marks are no longer all listed as mistakes.
- Planner: tasks missed before a past exam date are kept instead of disappearing.

## Wording and privacy
- No product names of other AI companies in the app; keys are described by where they come from and how they start.
- Account wording: no more "we have no server"; crash-report text explains exactly when something is sent.
- No iPhone/iPad support is claimed until an iOS app ships.
- Backup file names use your local date, not UTC.
- Developer panel: removed an outdated note about Google sign-in test users.

## Testing status
- Automated: unit + lint, browser suite, glass visual regression check, secret scan.
- Real-device Android install: **NOT YET RUN** (needs the owner's phone).
- Windows install: **NOT YET RUN**.

## Installing on an Android phone

1. Download `Prvlar-0.9.10.apk` in **Chrome** (not from Gmail or the GitHub app). The full file is 20.4 MB (SHA-256 `3669dd562fecdeff49338c0dfd0d8656147962c8efd087c86dce2a14884fda7d`). If the download looks small or is still in progress, download it again.
2. Open it from the Files app: **Files by Google › Downloads › Prvlar-0.9.10.apk**.
3. If Android asks, tap **Settings** and turn on **Allow from this source** for Chrome or Files, then go back and tap **Install**.
4. If tapping the file does nothing: **Settings › Apps › Special app access › Install unknown apps**, allow Files by Google and Chrome, then try again.
5. If an older Prvlar is already installed, this upgrades it in place and keeps your data. Only if Android says the package conflicts with an existing one, uninstall the older Prvlar first.
