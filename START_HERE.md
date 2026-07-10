# START_HERE — Maintenance Portal handoff

## 2026-07-10 — Cloud State Sync (multi-device fix)
- Root cause of "every device is a different app": localStorage was source of truth; Sheet was push-only (4 log types), nothing ever read back.
- NEW: `getState`/`saveState` cloud sync. On load, app hydrates from Sheet "State" tab; localStorage is offline fallback only. Debounced pushes gated behind hydration; stale-write guard (updatedAt) + LockService on Apps Script side.
- Synced collections: assets, logs, machines, gaugeLogs, workEntries, watchItems. EXCLUDED: assetPhotos, mapImage (per-device for now).
- Fixed pre-existing bug: workEntries was never saved to localStorage (Daily Work Log lost on refresh).
- Header sync badge: ☁️ Synced / ⚠ Local only / ⟳ Syncing.
- ⚠️ MANUAL STEP: paste `apps-script/state-sync.gs` into Apps Script project, wire saveState + uploadPhoto into doPost and getState into doGet, deploy NEW VERSION.

## 2026-07-10 (2) — Gauge Photos → Drive
- Gauge log: per-entry "📷 Photo/Replace" button (camera or upload) + scan photos now auto-upload to Drive in background.
- Photos resize client-side (~1000px JPEG), upload via new `uploadPhoto` Apps Script action to Drive folder "Maintenance Portal Photos", entry stores small embeddable URL (drive.google.com/thumbnail) which syncs across devices.
- Cloud push now sanitizes: base64 `data:` photos are stripped from saveState payloads (local display still works); only Drive URLs sync.
- Apps Script: added handleUploadPhoto_ to state-sync.gs. doPost needs BOTH lines: saveState + uploadPhoto. First upload will trigger a new Drive permission authorization prompt.
