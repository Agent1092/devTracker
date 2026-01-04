<p align="center">
  <img src="https://raw.githubusercontent.com/Agent1092/devTracker/main/logo.png" width="96" />
</p>

<h1 align="center">DevTracker</h1>
<p align="center"><i>A local-first developer activity tracker for VS Code</i></p>

<p align="center">
  <a href="https://github.com/Agent1092/devTracker/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/Agent1092/devTracker?style=for-the-badge"></a>
  <a href="https://github.com/Agent1092/devTracker/issues"><img alt="Issues" src="https://img.shields.io/github/issues/Agent1092/devTracker?style=for-the-badge"></a>
  <a href="https://github.com/Agent1092/devTracker/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Agent1092/devTracker/ci.yml?style=for-the-badge"></a>
  <a href="https://github.com/Agent1092/devTracker/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/Agent1092/devTracker?style=for-the-badge"></a>
</p>

<p align="center">
  <b>DevTracker answers one question:</b><br/>
  <i>“What did I actually work on?”</i><br/>
  <sub>Local-first. Offline. No cloud. No spyware.</sub>
</p>

---

## 🚀 DevTracker (Beta)

DevTracker is a **local-first VS Code extension** that quietly records file snapshots (locally) and surfaces **useful work insights** when you need them.

It’s built for individual developers who want:
- ✅ context after a break
- ✅ proof of progress (without time tracking)
- ✅ quick diffs + undo confidence
- ✅ zero cloud / zero remote upload

---

## Why DevTracker?

Developers constantly ask:
- *“What did I work on yesterday?”*
- *“Which file did I touch the most this week?”*
- *“What changed before I broke this?”*

DevTracker gives you answers without:
- ❌ cloud sync
- ❌ remote monitoring agents
- ❌ team surveillance dashboards
- ❌ heavy overhead

**Your data stays on your machine. Always.**

---

## ✨ Features (v0.9.8 — Beta)

### 🧠 Daily Reflection (Auto, Silent)
- On next startup, DevTracker shows a **clean “Yesterday at a glance”** popup
- Highlights:
  - files touched
  - intensity (quick touch vs deep work)
  - top activity
  - small technical insights (non-AI)

> Perfect for morning context. Zero effort.

---

### 🗂️ Local History Panel (1 month)
- Explore your recent work as a **collapsible folder/file tree**
- Open diffs for any snapshot
- See effort distribution quickly

---

### 🔍 Instant Diff Viewer
- Compare any tracked snapshot with current file state
- Jump through diffs inside VS Code

---

### ↩️ Bulk Revert (Local-only)
- Undo all changes from your **last session** for a folder
- One confirmation, fully local
- No bulk revert from Global views (safer by design)

---

### 📊 Local Summary (Premium-style popup)
- Manual “Local Summary” shows a **blurred modal card**
- Fast, skimmable, technical, and local-only

---

### 📅 Weekly & Monthly Reflection (Global overview)
- Reflection-style dashboards showing:
  - total touched files + snapshots
  - top projects/roots (collapsed list)
  - top files across the system
  - peak day + top filetype

> Great for “what happened this week/month?” without time tracking.

---

## 🟢 Core Principles
- ✅ Local-first
- ✅ Works offline
- ✅ No cloud sync
- ✅ No background VMs
- ✅ No performance drama
- ✅ Undo-friendly workflows

---

## 🧠 How it works

DevTracker runs a **lightweight embedded local service** inside the extension.

- Changes → snapped locally
- Data → stored locally
- Summaries → computed locally

**Nothing is uploaded. Nothing is tracked remotely.**

---

## 🧩 For GitHub nerds (the fun part)

### ✅ Works great alongside Git
DevTracker is not Git. It’s your **personal “work memory” layer**:
- before commits
- during refactors
- during experiments
- while testing random ideas

### ✅ Debug confidently
Find the snapshot and diff *before the break happened*.

### ✅ Proof-of-work (without timesheets)
Weekly/monthly reflections help you answer:
- “What did I touch most?”
- “What got messy?”
- “Where did time actually go?”

---

## 🔮 What’s coming next
DevTracker is still in beta. Next:
- Improved Global history view (folder + file drilldown)
- Smarter “focus” detection (still non-AI / local)
- Better notification controls
- Cloud mode (opt-in) later — **not required**

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
🔗 *(Link will be added after marketplace approval)*

---

## Who is DevTracker for?
- Individual developers
- Privacy-conscious engineers
- Offline/low-distraction workflows
- Anyone who wants **daily clarity** without overhead

---

## What DevTracker is NOT
- ❌ Employee monitoring
- ❌ Time-tracking spyware
- ❌ Cloud-first analytics
- ❌ Productivity surveillance

---

## From source

```bash
git clone https://github.com/Agent1092/devTracker.git
cd vscode-extension
npm install
npm run compile
```
---

## ⭐ If this saves you even 10 minutes…
Drop a star. It helps this project survive.

---

## 🧪 Beta disclaimer
Expect rapid iteration. If something feels off, open an issue with screenshots.
