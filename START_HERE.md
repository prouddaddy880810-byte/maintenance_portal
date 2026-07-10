
## 2026-07-10 (2) — Gauge Photos → Drive
- Gauge log: per-entry "📷 Photo/Replace" button (camera or upload) + scan photos now auto-upload to Drive in background.
- Photos resize client-side (~1000px JPEG), upload via new `uploadPhoto` Apps Script action to Drive folder "Maintenance Portal Photos", entry stores small embeddable URL (drive.google.com/thumbnail) which syncs across devices.
- Cloud push now sanitizes: base64 `data:` photos are stripped from saveState payloads (local display still works); only Drive URLs sync.
- Apps Script: added handleUploadPhoto_ to state-sync.gs. doPost needs BOTH lines: saveState + uploadPhoto. First upload will trigger a new Drive permission authorization prompt.
