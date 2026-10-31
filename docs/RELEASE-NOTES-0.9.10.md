# Prvlar 0.9.10 (hotfix for 0.9.9)

## Fixes
- Android: reminders no longer log "LocalNotifications.then() is not implemented" errors.
- Documents whose sections have no label (older saves, imports or merged documents) no longer crash when opening AI features or the context size check.
- Developer panel: removed an outdated note about Google sign-in test users (sign-in is open to everyone).

- Age check: the date-of-birth screen is replaced by a single “I’m 18 or older” checkbox before online AI, Google sign-in/cloud features and problem reports. Only the confirmation and its date are stored. Offline features never need it. You can withdraw it in Settings.
- Faster on phones: reminder permission checks no longer hold up start-up; on low-memory devices the PDF reader and code editor load on first use instead of right after start, and live background blur is replaced by solid surfaces (same features and layout).
- Android: a failed reminder-permission check can no longer stop start-up from finishing.

## Testing status
- Automated: unit + lint, full browser suite, Smarty action tests, secret scan.
- Real-device Android install: **NOT YET RUN**.
- Windows install: **NOT YET RUN**.

## Reports and release approval
- "Report AI answer" now reaches the developer: a cleaned-up report (no email, no whole documents) is sent, with a "Report sent" confirmation; offline reports are queued and retried. A copy stays on your device.
- Owner: Developer panel › Release approval shows the installed version and build and records the owner's approval. New versions become the latest release only after that approval.
