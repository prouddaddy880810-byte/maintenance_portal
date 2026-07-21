# Maintenance Portal — Living Error Log

Bugs, root causes, and prevention rules. Check new bugs against these patterns FIRST.

---

## 2026-07-21 — Triple bug: picker missing compressors, manual entry vanishing, AI parse dead

**Bug 1 — Gauge picker only showed Kaeser.** Picker filtered `assets` by /compressor/i; Machine DB entries (Gardner Denver, Atlas Copco from nameplate scans) were never merged in. Fix: merge Machine DB into pickList, matching name/make/model/category/description against a compressor-brand regex, deduped by name.

**Bug 2 — Manual entry saved nothing.** EditModal onSave used `setGaugeLogs(p=>p.map(...))` — `.map()` can only UPDATE, never INSERT. A brand-new manual entry's id was never in the list, so the save was a silent no-op. Fix: upsert (insert when id not found) + sheetsPost on insert. **New checklist pattern: any onSave shared between "edit existing" and "create new" must upsert, not map.** Sibling of the orphaned-setter class: a state write that silently does nothing.

**Bug 3 — Photos not parsing.** `aiCall` had regressed to a direct browser call to api.anthropic.com using `VITE_ANTHROPIC_API_KEY` — intentionally unset since the key moved server-side. Every AI request went out with an empty key → 401 → null → "Couldn't parse." Fix: routed aiCall back through the `/api/ai` Vercel proxy. **Prevention: pre-push grep — client code must contain zero `api.anthropic.com` references; all AI calls go through `/api/ai`.**

Pre-push checklist ran clean: orphaned-setter sweep ✅, prod build ✅, SSR render ✅, jsdom mount ✅.
