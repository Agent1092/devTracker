<p align="center">
  <img src="https://raw.githubusercontent.com/Agent1092/devTracker/main/logo.png" width="96" alt="DevTracker logo" />
</p>

<h1 align="center">DevTracker</h1>
<p align="center"><i>VS Code Activity Tracker • Local Work Log • Diffs, History & Revert • Offline & Privacy-first</i></p>

<p align="center">
  <a href="https://github.com/Agent1092/devTracker/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/Agent1092/devTracker?style=for-the-badge"></a>
  <a href="https://github.com/Agent1092/devTracker/issues"><img alt="Issues" src="https://img.shields.io/github/issues/Agent1092/devTracker?style=for-the-badge"></a>
  <a href="https://github.com/Agent1092/devTracker/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Agent1092/devTracker/ci.yml?branch=main&style=for-the-badge"></a>
  <a href="https://github.com/Agent1092/devTracker/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/Agent1092/devTracker?style=for-the-badge"></a>
</p>


<p align="center">
  <b>DevTracker answers one question:</b><br/>
  <i>“What did I actually work on?”</i><br/>
  <sub>Local-first. Offline. No spyware. Optional Pro cloud summaries only with consent.</sub>
</p>

<p align="center">
  <b>Search keywords:</b>
  VS Code activity tracker, developer activity, work log, timesheet, code history, local history, diff, revert, offline, privacy
</p>

---

## 🚀 DevTracker — VS Code Activity Tracker (Local-first)

DevTracker is a **local-first VS Code extension** that records **file snapshots locally** and helps you generate a **work log** using:
- **Diffs** (what changed)
- **Local history** (when you changed it)
- **Revert tools** (undo confidently)
- **Daily / Weekly / Monthly reflections** (what you worked on)
- **Exports** (PDF / MD / TXT / XLSX)

✅ Designed for individual developers who want clarity without surveillance.  
✅ Works offline. Your data stays on your machine.

---

## Why DevTracker?

Developers keep asking:
- *“What did I work on yesterday?”*
- *“Which files did I touch most this week?”*
- *“What changed before I broke this?”*
- *“How do I write a weekly update / work report / timesheet?”*

DevTracker gives you answers **without**:
- ❌ cloud sync by default
- ❌ remote monitoring agents
- ❌ team surveillance dashboards
- ❌ heavy overhead

**Your snapshots are local. Always.**

---

## ✨ Features

### 🧠 Daily Reflection (Auto Work Log)
- On next startup, DevTracker shows a **“Yesterday at a glance”** popup
- Highlights:
  - files touched
  - quick touch vs deep work
  - top activity
  - local technical insights (non-AI)

> Perfect for morning context. Zero effort.

---

### 🗂️ Local History Panel (Snapshot Timeline)
- Browse your recent work as a **collapsible folder/file tree**
- Open diffs for any snapshot
- See effort distribution quickly

---

### 🔍 Instant Diff Viewer (VS Code Diff)
- Compare any tracked snapshot with current file state
- Jump through diffs inside VS Code

---

### ↩️ Bulk Revert (Local-only)
- Undo all changes from your **last session** for a folder
- One confirmation, fully local
- Safer-by-design: bulk revert stays **local scope**

---

### 📊 Local Summary (Offline)
- Manual “Local Summary” shows a **fast skimmable** summary card
- Technical and local-only

---

### 📅 Weekly & Monthly Reflection (Work Report)
Reflection dashboards showing:
- total touched files + snapshots
- top roots/projects
- top files across the system
- peak day + top filetype
- **one-click copy** for sharing status updates

> Great for “what happened this week/month?” without time tracking spyware.

---

### 🧾 Exports: PDF (Basic + Premium), MD/TXT/XLSX
DevTracker ships with **two PDF export modes**:

- **Basic PDF (always works):** lightweight fallback export
- **Premium PDF (charts + clean layout):** rendered via Chromium for accurate HTML/CSS dashboards

✅ Premium export may require a **one-time “PDF Engine (Chromium)” install** on first use.  
No browser is bundled inside the VSIX (keeps downloads small for Marketplace + Open VSX).

---

## 🟢 Core Principles (Privacy-first)
- ✅ Local-first
- ✅ Works offline
- ✅ No employee monitoring
- ✅ No performance drama
- ✅ Undo-friendly workflows

---

## 🧠 How it works (Local-first by design)

DevTracker runs a **lightweight embedded local service** inside the extension.

- Changes → snapped locally
- Data → stored locally
- Summaries → computed locally

**Nothing is uploaded by default.**

---

## 🔑 DevTracker Pro (optional AI, still privacy-first)

DevTracker Pro adds an optional “cloud narrative” bridge when you want AI output:

- **Pro Narratives (Daily / Weekly / Monthly):** richer reports with export to MD / TXT / PDF / XLSX
- **Summary mode toggle:** choose **Local** (offline) or **Cloud (AI)** per request
- **Opt-in cloud summaries:** runs only after (a) GitHub login, (b) active Pro entitlement, and (c) explicit cloud consent
- **Cloud upload filters:** respects `devtracker.cloud.exclude` to avoid sending sensitive files
- **Supabase-backed GitHub OAuth login** with session refresh
- **OpenAI key does NOT ship in VSIX:** stored in Supabase Edge Function secret for hosted flow

**Local-first promise:** Everything runs locally by default. Cloud summaries happen only when you switch to Cloud mode and give consent.

---

## Plans: Free vs Pro

- **Shared (Free + Pro):** local snapshot capture, daily/weekly/monthly reflections, instant diffs, bulk revert, exports, retro/dark theme
- **Pro:** Pro Narratives + advanced exports + Local/Cloud mode toggle + consent-gated cloud summaries + Pro Home entitlement actions + Preview Weekly Narrative

---

## 🧩 Works great alongside Git (but it’s not Git)
DevTracker is your **personal “work memory” layer**:
- before commits
- during refactors
- experiments / spikes
- debugging regressions

> If Git answers “what changed in the repo”, DevTracker answers “what did I work on?”

---

## 📸 Screenshots

### Activity Bar Home
![Home](https://raw.githubusercontent.com/Agent1092/devTracker/main/screenshots/sidebar.png)

### History Panel
![History](https://raw.githubusercontent.com/Agent1092/devTracker/main/screenshots/history.png)

### Diff Viewer
![Diff](https://raw.githubusercontent.com/Agent1092/devTracker/main/screenshots/quick%20latest%20diff.png)

### Local Summary (Popup)
![Summary](https://raw.githubusercontent.com/Agent1092/devTracker/main/screenshots/local%20summary.png)

---

## 📦 Installation

### VS Code Marketplace
🔗 https://marketplace.visualstudio.com/items?itemName=GenomorphPvtLtd.devtracker

### Open VSX
🔗 https://open-vsx.org/extension/GenomorphPvtLtd/devtracker

---

## Quick start
1) Install DevTracker
2) Open the **DevTracker** activity bar
3) Work normally
4) Use **DevTracker: Open History Panel** and **DevTracker: Open Diff From Recent Snapshot**
5) Export weekly/monthly reflections when you need a work report

---

## FAQ

### Does DevTracker track time?
No. DevTracker tracks **local snapshots and diffs**, not timers.

### Is this employee monitoring or spyware?
No. DevTracker is built for individual developers. No cloud dashboards, no remote tracking, no team surveillance.

### Does DevTracker upload my code?
Not by default. Only **Pro cloud summaries** may upload selected code context **after consent** and filters.

---

## From source

```bash
git clone https://github.com/Agent1092/devTracker.git
cd vscode-extension
npm install
npm run compile
