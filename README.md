<p align="center">
  <img src="logo.png" width="96" />
</p>

<h1 align="center">DevTracker</h1>
<p align="center"><i>Local-first developer activity tracker for VS Code</i></p>

---

## 🚀 DevTracker (Beta)

DevTracker is a **local-first VS Code extension** that helps developers understand *what they actually worked on* — without cloud sync, spyware, or performance overhead.

### Why DevTracker?
- Developers lose track of daily changes
- Existing tools rely on cloud monitoring or heavy agents
- Offline workflows are ignored

DevTracker fixes this.

---

## ✨ Features (v0.9.3 — Beta)

- **Instant Diff Viewer**
  - View changes captured by DevTracker snapshots

- **Local History (up to 1 month)**
  - Maintains lightweight local change history

- **Unlimited Local Summaries**
  - Generate summaries locally (no cloud dependency)

✅ Local-first  
✅ Works offline  
✅ No background VMs  
✅ No performance impact  

---

## 🧠 How it works

DevTracker runs a **lightweight embedded local service** inside the extension and stores all data **locally on your machine**.

No data leaves your system.

> Team and business workspace features will be introduced in future versions.

## Screenshots

### Activity Bar Home
![Home](./screenshots/sidebar.png)

### Activity Bar Home
![History](./screenshots/history.png)

### Diff Viewer
![Diff](./screenshots/quick%20latest%20diff.png)

### Local Summary
![Summary](./screenshots/local%20summary.png)

---

## 📦 Installation

### VS Code Marketplace
🔗 *(Link will be added after marketplace approval)*

## Who is this for?
- Individual developers
- Privacy-conscious engineers
- Offline / low-distraction workflows
- People who want daily/weekly work summaries

## What DevTracker is NOT
- ❌ Employee monitoring
- ❌ Time tracking spyware
- ❌ Cloud-first analytics


### From source
```bash
git clone https://github.com/Agent1092/devTracker.git
cd vscode-extension
npm install
