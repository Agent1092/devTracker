
---

## ✅ Updated CHANGELOG (paste as-is)

```md
# Changelog

## v1.0.2 — 2026-02-11

### Added
- Command: **DevTracker: Set OpenAI API Key** saves the key to VS Code Secret Storage and passes it to the backend automatically.
- Backend now surfaces a clear message when the OpenAI key is missing.
- Cloud summaries now call a Supabase Edge Function (`devtracker-cloud-summary`) that holds the `OPENAI_API_KEY` secret; key no longer ships in the VSIX.

### Improved
- Marketplace/Open VSX discoverability: updated extension metadata (categories/keywords) and listing copy to align with search intent:
  - *VS Code activity tracker, work log, timesheet, code history, diff, revert, offline, privacy.*
- README restructured for faster scanning and higher conversion (clearer “what it does”, quick start, FAQ, and install links).

### Fixed
- Ensures the saved OpenAI key is injected into the embedded server only when env `OPENAI_API_KEY` is absent.

### Notes
- No behavior change for Free tier; Pro uses built-in Supabase defaults unless you override them.

---

## v1.0.0 — 2026-02-11

### Added
- **DevTracker Pro (GA):** daily/weekly/monthly Pro Narratives with exports to MD/TXT/PDF/XLSX.
- **Summary mode toggle:** choose Local (offline) or Cloud (AI) per request.
- **Cloud consent gate:** AI summaries only run after login + active Pro entitlement + explicit consent; respects `devtracker.cloud.exclude` for code filtering.
- **Supabase GitHub login:** built-in defaults with optional override via settings; auto token refresh.
- **Entitlement-aware Pro Home:** surfaces login/refresh/upgrade/preview/generate actions based on status; shows Preview Weekly Narrative for logged-in but not-entitled users.

### Improved
- README describes Pro GA, opt-in cloud path, and the Free vs Pro split.
- UI copy clarifies local-first promise and when cloud is invoked.

### Fixed
- Prevent cloud mode from running without consent, entitlement, or login.

### Notes
DevTracker remains **local-first**. Cloud summaries run only when you switch to Cloud mode *and* grant consent.

---

## v0.10.3 — 2026-02-06

### Added
- Entitlement-aware Pro Home: when logged in but not entitled, shows only Logout, Refresh entitlement, Preview Weekly Narrative, and Upgrade.
- Preview Weekly Narrative sample: disabled exports, CTA to Pro Home/Settings, and explicit `source` labeling in the Pro summary view.
- Summary routing tags bundles with `source` (local/cloud/preview) and enforces consent before cloud calls.

### Improved
- README clarifies Free vs Pro tiers while reaffirming DevTracker’s local-first DNA; Pro is the optional bridge when you choose cloud summaries.

### Fixed
- Prevent preview summaries from offering exports to avoid broken flows.

### Notes
DevTracker remains **local-first**. Cloud summaries run only when you switch to Cloud mode *and* grant consent.

---

## v0.10.2 — 2026-01-27

### Added
- **Premium PDF Export (Chromium-rendered):** dashboard-style PDFs with charts + clean layout.
- **Basic PDF Export (fallback):** always-available export mode when premium engine isn’t installed.
- **One-time PDF Engine install flow:**
  - Prompt on first premium export
  - “Install PDF Engine (Chromium)” command
  - Auto-retry premium export after install
- Weekly/Monthly reflections: **one-click copy** for sharing work summary.

### Improved
- Reflection/report formatting: scope-correct labels (Daily/Weekly/Monthly) and cleaner markdown rendering.
- PDF layout stability (reduced overlap/clipping in charts and titles).

### Fixed
- Minor UX inconsistencies in summary rendering.
- ES2020 compatibility issues (removed `String.replaceAll` usage).

### Notes
DevTracker remains **local-first**, **offline**, and **privacy-focused**. Nothing is uploaded in the free/beta experience.
