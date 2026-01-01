<p align="center">
  <img src="https://raw.githubusercontent.com/Agent1092/devTracker/main/logo.png" width="96" />
</p>

<h1 align="center">DevTracker</h1>
<p align="center"><i>A local-first developer activity tracker for VS Code</i></p>

---

## 🚀 DevTracker (Beta)

DevTracker is a **local-first VS Code extension** that helps developers understand  
**what they actually worked on** — without cloud sync, monitoring agents, or performance overhead.

It runs quietly in the background and surfaces insights **when they matter**.

---

## Why DevTracker?

Most developers ask questions like:
- *“What did I work on yesterday?”*
- *“Which files did I touch the most?”*
- *“What changed before I broke this?”*

But existing tools are either:
- Cloud-heavy  
- Focused on teams instead of individuals  
- Or too intrusive for daily use  

DevTracker is built for **individual developers** who value:
- clarity
- privacy
- offline workflows

---

## ✨ Features (v0.9.7 — Beta)

### 🔔 Startup Session Summary
- Automatically shows a popup on VS Code startup
- Summarizes **what you worked on in your last session**
- Helps you instantly regain context after a break

---

### 🗂️ Local History Panel
- View up to **1 month of local change history**
- Organized in a **collapsible folder & file tree**
- Easily see where your effort went

---

### 🔍 Instant Diff Viewer
- Open diffs from any tracked snapshot
- Compare current code with previous states
- Navigate changes quickly inside VS Code

---

### ↩️ Bulk Revert (Folder-based)
- Undo all changes from your **last session** for a folder
- One confirmation, fully local, undoable
- No guessing which files to revert

---

### 📊 Local Summaries
- Generate summaries of files touched per day
- Runs completely offline
- No data leaves your machine

---

### 🟢 Core Principles
- ✅ Local-first
- ✅ Works offline
- ✅ No background VMs
- ✅ No cloud sync
- ✅ No performance impact
- ✅ Undo-friendly (Ctrl+Z still works)

---

## 🧠 How it works

DevTracker runs a **lightweight embedded local service** inside the VS Code extension.

- File changes are snapshotted locally
- Data is stored on your machine
- Processing happens only when needed

**Nothing is uploaded. Nothing is tracked remotely.**

---

## 🔮 What’s coming next

DevTracker is still in beta. Upcoming improvements include:
- Weekly and monthly work insights
- Smarter summaries across longer time ranges
- Improved global history views
- More context-aware notifications

All future features will continue to respect the **local-first, privacy-first** philosophy.

---

## 📸 Screenshots

### Activity Bar Home
![Home](https://raw.githubusercontent.com/Agent1092/devTracker/main/screenshots/sidebar.png)

### Activity Bar Home
![History](https://raw.githubusercontent.com/Agent1092/devTracker/main/screenshots/history.png)

### Diff Viewer
![Diff](https://raw.githubusercontent.com/Agent1092/devTracker/main/screenshots/quick%20latest%20diff.png)

### Local Summary
![Summary](https://raw.githubusercontent.com/Agent1092/devTracker/main/screenshots/local%20summary.png)

---

## 📦 Installation

### VS Code Marketplace
🔗 *(Link will be added after marketplace approval)*

---

## Who is DevTracker for?
- Individual developers
- Privacy-conscious engineers
- Offline or low-distraction workflows
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
