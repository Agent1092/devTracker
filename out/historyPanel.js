"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryPanel = void 0;
// src/historyPanel.ts
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const apiClient_1 = require("./apiClient");
const session_1 = require("./session");
function normalize(p) {
    return p.replace(/\\/g, "/");
}
function relToBase(abs, base) {
    const a = normalize(abs);
    const r = normalize(base).replace(/\/+$/, "");
    if (a === r)
        return "";
    if (a.startsWith(r + "/"))
        return a.slice(r.length + 1);
    return null;
}
class HistoryPanel {
    constructor(context, installationId) {
        this.context = context;
        this.installationId = installationId;
    }
    async open() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            await this.refresh();
            return;
        }
        this.panel = vscode.window.createWebviewPanel("devtrackerHistory", "DevTracker — History", vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        this.panel.onDidDispose(() => (this.panel = undefined));
        this.panel.webview.onDidReceiveMessage(async (msg) => {
            try {
                if (msg?.type === "openDiff") {
                    await this.openDiff(Number(msg.snapshotId), String(msg.filePath));
                    return;
                }
                if (msg?.type === "revert") {
                    // hard safety: no revert from global
                    if (String(msg.scope) === "global") {
                        vscode.window.showInformationMessage("DevTracker: Revert is only available in Local History.");
                        return;
                    }
                    await this.revertToSnapshot(Number(msg.snapshotId), String(msg.filePath));
                    return;
                }
                if (msg?.type === "refresh") {
                    await this.refresh();
                    return;
                }
                if (msg?.type === "bulkRevertFolder") {
                    if (String(msg.scope) === "global") {
                        vscode.window.showInformationMessage("DevTracker: Bulk Revert is only available in Local History.");
                        return;
                    }
                    const folderRel = String(msg.folderRel || "");
                    await this.bulkRevertLastSession(folderRel);
                    await this.refresh();
                    return;
                }
            }
            catch (err) {
                vscode.window.showErrorMessage(`DevTracker: action failed: ${err?.message ?? err}`);
            }
        });
        this.panel.webview.html = this.html(this.panel.webview);
        await this.refresh();
    }
    async refresh() {
        if (!this.panel)
            return;
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsRoot) {
            this.panel.webview.postMessage({
                type: "error",
                message: "Open a workspace folder to use DevTracker History.",
            });
            return;
        }
        let snaps = [];
        try {
            snaps = await (0, apiClient_1.getLatestSnapshots)(this.installationId, 1600);
        }
        catch (err) {
            this.panel.webview.postMessage({
                type: "error",
                message: `Could not load history. Is backend running? (${err?.message ?? err})`,
            });
            return;
        }
        this.panel.webview.postMessage({
            type: "data",
            payload: { snaps, wsRoot },
        });
    }
    async openDiff(snapshotId, filePath) {
        const leftUri = vscode.Uri.parse(`devtracker-snapshot:/${snapshotId}`);
        const rightUri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, `DevTracker Diff: ${path.basename(filePath)}`);
    }
    async revertToSnapshot(snapshotId, filePath) {
        const ok = await vscode.window.showWarningMessage(`Revert "${path.basename(filePath)}" to snapshot #${snapshotId}?\n\nTip: You can undo with Ctrl+Z.`, { modal: true }, "Revert");
        if (ok !== "Revert")
            return;
        const snap = await (0, apiClient_1.getSnapshot)(snapshotId);
        const snapshotText = snap.full_text ?? "";
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        await editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, snapshotText);
        });
        vscode.window.showInformationMessage("DevTracker: Reverted (Ctrl+Z to undo).");
    }
    /**
     * Bulk revert: Local-only (current workspace folder only)
     */
    async bulkRevertLastSession(folderRel) {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsRoot)
            return;
        const last = (0, session_1.getLastSessionWindow)(this.context);
        if (!last) {
            vscode.window.showInformationMessage("DevTracker: No previous session window found yet.");
            return;
        }
        folderRel = folderRel.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
        if (!folderRel)
            folderRel = "";
        let snaps = [];
        try {
            snaps = await (0, apiClient_1.getLatestSnapshots)(this.installationId, 2000);
        }
        catch (e) {
            vscode.window.showErrorMessage(`DevTracker: Failed to load snapshots. ${e?.message ?? e}`);
            return;
        }
        const startT = new Date(last.startIso).getTime();
        const root = normalize(wsRoot).replace(/\/+$/, "");
        const folderAbsPrefix = folderRel ? `${root}/${folderRel}` : root;
        function underFolder(abs) {
            const a = normalize(abs);
            return a === folderAbsPrefix || a.startsWith(folderAbsPrefix + "/");
        }
        const byFile = new Map();
        for (const s of snaps) {
            // keep only current workspace
            const rel = relToBase(s.file_path, wsRoot);
            if (rel == null)
                continue;
            if (!underFolder(s.file_path))
                continue;
            const arr = byFile.get(s.file_path) ?? [];
            arr.push(s);
            byFile.set(s.file_path, arr);
        }
        if (byFile.size === 0) {
            vscode.window.showInformationMessage(`DevTracker: No tracked files found under "${folderRel || "(root)"}".`);
            return;
        }
        const restorePlan = [];
        for (const [filePath, arr] of byFile.entries()) {
            arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const candidate = arr.find((s) => new Date(s.created_at).getTime() < startT);
            if (candidate)
                restorePlan.push({ filePath, snapshotId: candidate.id });
        }
        if (!restorePlan.length) {
            vscode.window.showInformationMessage(`DevTracker: No pre-session snapshots available to revert under "${folderRel || "(root)"}".`);
            return;
        }
        const confirm = await vscode.window.showWarningMessage(`Bulk Revert will overwrite ${restorePlan.length} file(s) under "${folderRel || "(root)"}". Continue?`, { modal: true }, "Revert");
        if (confirm !== "Revert")
            return;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `DevTracker: Reverting ${restorePlan.length} files…`,
            cancellable: false,
        }, async (progress) => {
            let done = 0;
            for (const item of restorePlan) {
                try {
                    const detail = await (0, apiClient_1.getSnapshot)(item.snapshotId);
                    const uri = vscode.Uri.file(item.filePath);
                    const dir = path.dirname(item.filePath);
                    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(detail.full_text ?? "", "utf8"));
                }
                catch {
                    // continue
                }
                finally {
                    done++;
                    progress.report({ message: `${done}/${restorePlan.length}` });
                }
            }
        });
        vscode.window.showInformationMessage(`DevTracker: Bulk revert complete for "${folderRel || "(root)"}".`);
    }
    html(webview) {
        const nonce = String(Date.now());
        return /* html */ `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevTracker — History</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --accent: var(--vscode-button-background);
      --accentFg: var(--vscode-button-foreground);
      --inputBg: var(--vscode-input-background);
      --inputFg: var(--vscode-input-foreground);
      --listHover: var(--vscode-list-hoverBackground);
      --listActive: var(--vscode-list-activeSelectionBackground);
      --listActiveFg: var(--vscode-list-activeSelectionForeground);
    }
    body {
      margin: 0;
      padding: 12px;
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    }

    .errBox {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px;
      color: var(--muted);
      margin-bottom: 12px;
      display: none;
    }

    .topRow {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }

    .search {
      flex: 1;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--inputBg);
      color: var(--inputFg);
      outline: none;
    }

    .btn {
      padding: 8px 12px;
      border: 0;
      border-radius: 10px;
      cursor: pointer;
      background: var(--accent);
      color: var(--accentFg);
      font-weight: 900;
    }

    /* ✅ segmented control for Local/Global */
    .segWrap {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      background: rgba(255,255,255,.03);
    }
    .segBtn {
      border: 0;
      background: transparent;
      color: var(--fg);
      padding: 7px 12px;
      font-weight: 900;
      cursor: pointer;
      font-size: 12px;
    }
    .segBtn.active {
      background: var(--listActive);
      color: var(--listActiveFg);
    }

    /* ✅ underline tabs for Today/Week/Month */
    .rangeTabs {
      display: flex;
      gap: 14px;
      align-items: center;
      margin: 10px 0 12px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
    }
    .rangeTab {
      border: 0;
      background: transparent;
      color: var(--muted);
      font-weight: 900;
      cursor: pointer;
      padding: 6px 2px;
      font-size: 12px;
      position: relative;
    }
    .rangeTab.active {
      color: var(--fg);
    }
    .rangeTab.active::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: -7px;
      height: 2px;
      background: var(--accent);
      border-radius: 999px;
    }

    .metaPill {
      margin-left: auto;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    .grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 12px;
      height: calc(100vh - 140px);
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .cardHeader {
      padding: 10px 12px;
      font-weight: 900;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .sub {
      font-weight: 700;
      font-size: 12px;
      color: var(--muted);
    }
    .list {
      overflow: auto;
      padding: 10px 10px;
      min-height: 0;
    }

    .tree {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.55;
      user-select: none;
    }
    .line {
      padding: 4px 8px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      white-space: nowrap;
    }
      .lineCol {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lineMain {
  display: flex;
  align-items: center;
  gap: 6px;
}

.linePath {
  font-size: 11px;
  color: var(--muted);
  padding-left: 20px; /* indent under folder icon */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

    .line:hover { background: var(--listHover); }
    .line.active { background: var(--listActive); color: var(--listActiveFg); }
    .left { overflow: hidden; text-overflow: ellipsis; }

    .badge {
      font-family: inherit;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted);
    }

    .snapItem {
      padding: 10px 10px;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .snapItem:hover { background: var(--listHover); }
    .row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .time { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace; font-size: 12px; color: var(--muted); }
    .actions { display:flex; gap:8px; }
    .mini {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--fg);
      padding: 4px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 900;
      font-size: 12px;
    }
    .mini:hover { background: var(--listHover); }
    .mini.danger { color: #ff6b6b; }

    .empty { padding: 16px; color: var(--muted); }
    .bulkBtn {
      border: 1px solid rgba(255,107,107,.55);
      color: #ff6b6b;
      background: transparent;
      padding: 6px 10px;
      border-radius: 10px;
      font-weight: 900;
      cursor: pointer;
      font-size: 12px;
    }
    .bulkBtn:hover { background: rgba(255,107,107,.08); }
  </style>
</head>

<body>
  <div id="err" class="errBox"></div>

  <div class="topRow">
    <input id="search" class="search" placeholder="Search file/folder..." />
    <button id="refresh" class="btn">Refresh</button>
  </div>

  <div class="topRow" style="margin-bottom:6px;">
    <div class="segWrap">
      <button class="segBtn active" data-scope="local">Local</button>
      <button class="segBtn" data-scope="global">Global</button>
    </div>
    <div class="metaPill" id="scopeHint">Local: current workspace</div>
  </div>

  <div class="rangeTabs">
    <button class="rangeTab active" data-mode="today">Today</button>
    <button class="rangeTab" data-mode="week">Week</button>
    <button class="rangeTab" data-mode="month">Month</button>
  </div>

  <div class="grid">
    <div class="card">
      <div class="cardHeader">
        <div>Explorer</div>
        <div class="sub" id="leftSub"></div>
      </div>
      <div class="list">
        <div id="tree" class="tree"></div>
      </div>
    </div>

    <div class="card">
      <div class="cardHeader">
        <div id="rightTitle">Snapshots</div>
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="sub" id="rightSub"></div>
          <button id="bulkBtn" class="bulkBtn" style="display:none;">Bulk Revert</button>
        </div>
      </div>
      <div class="list" id="rightList"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let wsRoot = "";
    let rawSnaps = [];

    let scope = "local"; // local | global
    let mode = "today";  // today | week | month
    let selectedDay = null;

    let expanded = new Set();
    let isInitialRender = true;
    let selectedNodeId = "folder:/";
    let selectedFolderRel = "";
    let selectedFileAbs = null;

    const err = document.getElementById("err");
    const tree = document.getElementById("tree");
    const leftSub = document.getElementById("leftSub");
    rightTitle.textContent = "Global";

// show full path (and avoid duplicates confusion)
const full = selectedFolderRel ? selectedFolderRel.split("::")[0] : "";
rightSub.textContent = full ? full : "Projects touched (collapsed)";

    const rightList = document.getElementById("rightList");
    const search = document.getElementById("search");
    const refreshBtn = document.getElementById("refresh");
    const bulkBtn = document.getElementById("bulkBtn");
    const scopeHint = document.getElementById("scopeHint");

    refreshBtn.addEventListener("click", () => vscode.postMessage({ type: "refresh" }));

    // scope segmented
    document.querySelectorAll("[data-scope]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-scope]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        scope = btn.dataset.scope;

        expanded = new Set();
        isInitialRender = true;
        selectedNodeId = "folder:/";
        selectedFolderRel = "";
        selectedFileAbs = null;

        computeAndRender();
      });
    });

    // range tabs
    document.querySelectorAll("[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-mode]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        mode = btn.dataset.mode;
        selectedDay = null;
        computeAndRender();
      });
    });

    search.addEventListener("input", () => computeAndRender());

    bulkBtn.addEventListener("click", () => {
      if (scope === "global") return;
      vscode.postMessage({ type: "bulkRevertFolder", folderRel: selectedFolderRel, scope });
    });

    window.addEventListener("message", (event) => {
      const msg = event.data;

      if (msg.type === "error") {
        err.style.display = "block";
        err.textContent = msg.message || "Unknown error";
        return;
      }

      if (msg.type === "data") {
        err.style.display = "none";
        err.textContent = "";

        wsRoot = msg.payload?.wsRoot || "";
        rawSnaps = msg.payload?.snaps || [];

        expanded = new Set();
        isInitialRender = true;
        selectedNodeId = "folder:/";
        selectedFolderRel = "";
        selectedFileAbs = null;

        computeAndRender();
      }
    });

    function computeRangeFilter() {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0,0,0,0);

      if (mode === "today") {
        const end = new Date(start);
        end.setDate(end.getDate()+1);
        return { start, end };
      }
      if (mode === "week") {
        start.setDate(start.getDate()-6);
        const end = new Date();
        end.setDate(end.getDate()+1);
        end.setHours(0,0,0,0);
        return { start, end };
      }
      // month => last 30 days
      const s = new Date();
      s.setHours(0,0,0,0);
      s.setDate(s.getDate()-30);
      const e = new Date();
      e.setDate(e.getDate()+1);
      e.setHours(0,0,0,0);
      return { start: s, end: e };
    }

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function pathBase(p) {
      const n = (p || "").replace(/\\\\/g,"/").replace(/\\/+$/, "");
      const parts = n.split("/").filter(Boolean);
      return parts[parts.length-1] || n;
    }

    function relFromAbsLocal(abs) {
      const a = (abs || "").replace(/\\\\/g, "/");
      const r = (wsRoot || "").replace(/\\\\/g, "/").replace(/\\/+$/, "");
      if (!r) return null;
      if (a === r) return "";
      if (a.startsWith(r + "/")) return a.slice(r.length + 1);
      return null;
    }

    // coding filter: keeps global view meaningful
    function isCodingPath(absPath) {
      const p = (absPath || "").toLowerCase().replace(/\\\\/g, "/");
      if (
        p.includes("/.git/") ||
        p.includes("/node_modules/") ||
        p.includes("/dist/") ||
        p.includes("/build/") ||
        p.includes("/out/") ||
        p.includes("/.next/") ||
        p.includes("/.cache/") ||
        p.includes("/coverage/")
      ) return false;

      if (/\.(ts|tsx|js|jsx|mjs|cjs|json|yaml|yml|md|py|java|kt|kts|go|rs|cpp|c|h|hpp|cs|php|rb|swift|sql|toml|ini|env|gradle|properties|xml|html|css|scss|less|sh|zsh|bat)$/i.test(p)) {
        return true;
      }

      const base = p.split("/").pop() || p;
      if (base === "dockerfile" || base === "makefile") return true;
      return false;
    }

    function matchesSearch(text) {
      const q = search.value.trim().toLowerCase();
      if (!q) return true;
      return String(text || "").toLowerCase().includes(q);
    }

    function fmt(iso) {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }

    // --- Tree builders ---
    // Shared folder helper
    function getOrCreateFolder(parent, folderName, relPath) {
      let child = parent.children.find(n => n.kind==="folder" && n.name===folderName && n.relPath===relPath);
      if (!child) {
        child = { kind:"folder", id:"folder:/" + relPath, name:folderName, relPath, count:0, children:[] };
        parent.children.push(child);
      }
      return child;
    }

    // Build nested tree from a baseRoot + snaps
    function buildTreeFromBase(baseRootLabel, baseRootPath, snaps, relFn) {
      const byFile = new Map();

      for (const s of snaps) {
        const rel = relFn(s.file_path);
        if (rel == null) continue;
        const arr = byFile.get(rel) || [];
        arr.push(s);
        byFile.set(rel, arr);
      }

      const root = { kind:"folder", id:"folder:/", name:baseRootLabel, relPath:baseRootPath, count:0, children:[] };

      for (const [rel, arr] of byFile.entries()) {
        arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        const versions = arr.map(v => ({ id: v.id, time: fmt(v.created_at), created_at: v.created_at }));
        const count = arr.length;

        const parts = rel.split("/").filter(Boolean);
        let cur = root;
        let curRel = "";

        for (let i=0; i<parts.length; i++) {
          const part = parts[i];
          const isFile = i === parts.length - 1;

          if (isFile) {
            cur.children.push({
              kind:"file",
              id:"file:/" + baseRootPath + "::" + rel,
              name: part,
              relPath: rel,
              absPath: arr[0].file_path,
              count,
              versions
            });
          } else {
            curRel = curRel ? (curRel + "/" + part) : part;
            const folderRelKey = baseRootPath + "::" + curRel;
            cur = getOrCreateFolder(cur, part, folderRelKey);
          }
        }
      }

      function compute(node) {
        if (node.kind==="file") return node.count;
        let sum = 0;
        node.children.forEach(c => { sum += compute(c); });
        node.count = sum;
        node.children.sort((a,b) => {
          if (a.kind !== b.kind) return a.kind==="folder" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        return sum;
      }
      compute(root);

      // Apply search: keep folders if they have any matching descendants
      function filterNode(node) {
        if (node.kind === "file") {
          return matchesSearch(node.relPath) || matchesSearch(node.name);
        }
        const keepKids = [];
        for (const c of node.children) {
          if (filterNode(c)) keepKids.push(c);
        }
        node.children = keepKids;
        return keepKids.length > 0 || matchesSearch(node.name) || matchesSearch(node.relPath);
      }
      filterNode(root);

      // recompute counts after filter
      compute(root);
      return root;
    }

    function buildLocalTree(snaps) {
      return buildTreeFromBase(
        pathBase(wsRoot) || "(root)",
        wsRoot,
        snaps,
        (abs) => relFromAbsLocal(abs)
      );
    }

    // Global: group by project_root (best), else fallback to 2-level parent folder
    function getProjectRootFromSnap(s) {
      // tolerate different naming if backend adds later
      const pr = s.project_root || s.projectRoot || null;
      if (pr && typeof pr === "string") return pr;
      const a = (s.file_path || "").replace(/\\\\/g, "/");
      const parts = a.split("/").filter(Boolean);
      // fallback: take parent dir (not ideal, but works without project_root)
      return parts.slice(0, -1).join("/");
    }

    function buildGlobalTree(snaps) {
      // Group snaps by projectRoot
      const byRoot = new Map();
      for (const s of snaps) {
        const rootPath = getProjectRootFromSnap(s);
        const arr = byRoot.get(rootPath) || [];
        arr.push(s);
        byRoot.set(rootPath, arr);
      }

      // Root of global explorer
      const globalRoot = { kind:"folder", id:"folder:/", name:"All Projects", relPath:"", count:0, children:[] };

      // Each project root is a folder node; inside it, we build a nested file tree
      for (const [rootPath, arr] of byRoot.entries()) {
        // keep only coding snaps in global
        const coding = arr.filter(x => isCodingPath(x.file_path));
        if (coding.length === 0) continue;

        // build subtree under this project root
        const sub = buildTreeFromBase(
          pathBase(rootPath),
          rootPath,
          coding,
          (abs) => {
            const a = (abs || "").replace(/\\\\/g, "/");
            const r = (rootPath || "").replace(/\\\\/g, "/").replace(/\\/+$/, "");
            if (!r) return null;
            if (a === r) return "";
            if (a.startsWith(r + "/")) return a.slice(r.length + 1);
            return null;
          }
        );

        // IMPORTANT: The subtree returned has id folder:/ — we must convert to a child folder node
        // We'll transplant its children into a project folder node.
        const projectNode = {
          kind: "folder",
          id: "folder:/" + rootPath,
          name: sub.name,
          relPath: rootPath,
          count: sub.count,
          children: sub.children || [],
        };

        // search can remove all children; skip empty roots
        if (!projectNode.children.length && !matchesSearch(projectNode.name) && !matchesSearch(projectNode.relPath)) {
          continue;
        }

        globalRoot.children.push(projectNode);
      }

      // Sort global roots by count desc
      globalRoot.children.sort((a,b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

      globalRoot.count = globalRoot.children.reduce((acc, c) => acc + (c.count || 0), 0);
      return globalRoot;
    }

    function flattenTree(node, prefix, lines) {
      function addLine(id, textLeft, badge, isActive) {
        lines.push({ id, textLeft, badge, isActive });
      }

      const isRoot = node.id === "folder:/";
      if (isRoot) {
        const marker = expanded.has(node.id) ? "▼" : "▶";
        addLine(node.id, marker + " 📁 " + node.name, node.count, selectedNodeId===node.id);
      }

      if (node.kind !== "folder") return;
      if (!expanded.has(node.id)) return;

      const kids = node.children || [];
      kids.forEach((child, idx) => {
        const isLast = idx === kids.length - 1;
        const joint = isLast ? "└─" : "├─";
        const spacer = isLast ? "   " : "│  ";

        if (child.kind === "folder") {
          const marker = expanded.has(child.id) ? "▼" : "▶";
          addLine(child.id, prefix + joint + " " + marker + " 📁 " + child.name, child.count, selectedNodeId===child.id);
          flattenTree(child, prefix + spacer, lines);
        } else {
          addLine(child.id, prefix + joint + " 📄 " + child.name, child.count, selectedNodeId===child.id);
        }
      });
    }

    function renderTree(root) {
      const lines = [];
      flattenTree(root, "", lines);

      leftSub.textContent = lines.length ? \`\${lines.length} items\` : "";
      tree.innerHTML = "";

      lines.forEach(l => {
        const el = document.createElement("div");
        el.className = "line" + (l.isActive ? " active" : "");
        const isGlobalFolder =
          scope === "global" &&
          l.id.startsWith("folder:/") &&
          l.id !== "folder:/";

        let fullPath = "";
        if (isGlobalFolder) {
          fullPath = l.id.replace("folder:/", "").split("::")[0];
        }

        el.innerHTML =
          '<div class="lineCol">' +
          '<div class="lineMain">' +
          '<div class="left">' + escapeHtml(l.textLeft) + "</div>" +
          "</div>" +
          (isGlobalFolder && fullPath
            ? '<div class="linePath">' + escapeHtml(fullPath) + "</div>"
            : "") +
          "</div>" +
          '<div class="badge">' + (l.badge || 0) + "</div>";


        el.onclick = () => {
          selectedNodeId = l.id;

          if (l.id.startsWith("folder:/")) {
            // toggle expand
            if (expanded.has(l.id) && l.id !== "folder:/") expanded.delete(l.id);
            else expanded.add(l.id);

            // Local: folderRel is relative inside workspace (bulk revert uses it)
            // Global: folderRel is rootPath or "rootPath::subfolder" (no bulk revert)
            const raw = l.id.replace("folder:/", "");
            if (scope === "local") {
              // Local folderRel should be "path inside wsRoot"
              // We store relKey like "wsRoot::sub" for internal nodes, so extract after ::
              const parts = raw.split("::");
              selectedFolderRel = parts.length === 2 ? parts[1] : "";
            } else {
              selectedFolderRel = raw; // informational only
            }

            selectedFileAbs = null;

            if (scope === "local") {
              bulkBtn.style.display = "inline-block";
              rightTitle.textContent = "Snapshots";
              rightSub.textContent = selectedFolderRel ? \`Folder: \${selectedFolderRel}\` : "Folder: (root)";
              rightList.innerHTML = '<div class="empty">Folder selected. Click a file to view snapshots. Use Bulk Revert to undo last session for this folder.</div>';
            } else {
              bulkBtn.style.display = "none";
              rightTitle.textContent = "Global";
              const show = selectedFolderRel ? selectedFolderRel.split("::")[0] : "";
              rightSub.textContent = show ? \`Project: \${pathBase(show)}\` : "Projects touched (collapsed)";
              rightList.innerHTML = '<div class="empty">Global view is read-only. Expand folders to see actual modified files. No revert actions here.</div>';
            }

            computeAndRender(); // re-render tree highlight
            return;
          }

          if (l.id.startsWith("file:/")) {
            // Find file node by walking rendered tree again is expensive; instead we just open snapshots in place.
            // We'll parse id: "file:/<root>::<rel>" (both local/global)
            const idPayload = l.id.replace("file:/", "");
            const parts = idPayload.split("::");
            const rel = parts.length === 2 ? parts[1] : idPayload;

            // locate fileNode by searching the built tree in computeAndRender (we store lastRootTree)
            const fileNode = findFileNode(lastTreeRoot, l.id);
            if (!fileNode) return;

            selectedFileAbs = fileNode.absPath;

            bulkBtn.style.display = "none";
            rightTitle.textContent = "Snapshots";
            rightSub.textContent = rel;

            renderSnapshots(fileNode);

            computeAndRender();
            return;
          }
        };

        tree.appendChild(el);
      });
    }

    function findFileNode(node, id) {
      if (!node) return null;
      if (node.kind === "file") return null;
      for (const c of (node.children || [])) {
        if (c.kind === "file" && c.id === id) return c;
        if (c.kind === "folder") {
          const r = findFileNode(c, id);
          if (r) return r;
        }
      }
      return null;
    }

    function renderSnapshots(fileNode) {
      rightList.innerHTML = "";
      if (!fileNode.versions || !fileNode.versions.length) {
        rightList.innerHTML = '<div class="empty">No snapshots to show.</div>';
        return;
      }

      fileNode.versions.forEach(v => {
        const el = document.createElement("div");
        el.className = "snapItem";

        el.onclick = () => vscode.postMessage({
          type: "openDiff",
          snapshotId: v.id,
          filePath: fileNode.absPath,
          scope
        });

        const showRevert = (scope === "local");

        el.innerHTML = \`
          <div class="row">
            <div class="time"><b>\${escapeHtml(v.time)}</b></div>
            <div class="actions">
              <button class="mini" data-action="diff">Diff</button>
              \${showRevert ? '<button class="mini danger" data-action="revert">Revert</button>' : ''}
            </div>
          </div>
          <div class="sub">Snapshot #\${v.id}</div>
        \`;

        el.querySelector('[data-action="diff"]').onclick = (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: "openDiff", snapshotId: v.id, filePath: fileNode.absPath, scope });
        };

        const revBtn = el.querySelector('[data-action="revert"]');
        if (revBtn) {
          revBtn.onclick = (e) => {
            e.stopPropagation();
            vscode.postMessage({ type: "revert", snapshotId: v.id, filePath: fileNode.absPath, scope });
          };
        }

        rightList.appendChild(el);
      });
    }

    let lastTreeRoot = null;

    function computeAndRender() {
      scopeHint.textContent =
        (scope === "local")
          ? "Local: current workspace (revert enabled)"
          : "Global: last 30 days, read-only";

      const { start, end } = computeRangeFilter();

      // range + coding filter
      const snapsInRange = rawSnaps.filter(s => {
        const t = new Date(s.created_at);
        if (!(t >= start && t < end)) return false;
        return isCodingPath(s.file_path);
      });

      const scopedSnaps = snapsInRange.filter(s => {
        if (scope === "global") return true;
        return relFromAbsLocal(s.file_path) !== null;
      });

      const treeRoot = (scope === "global")
        ? buildGlobalTree(scopedSnaps)
        : buildLocalTree(scopedSnaps);

      lastTreeRoot = treeRoot;

      // initial expansion behavior:
      if (isInitialRender) {
        if (scope === "local") {
          // expand root if useful
          const onlyChild = treeRoot.children.length === 1 ? treeRoot.children[0] : null;
          const rootHasSingleFolder = onlyChild && onlyChild.kind === "folder";
          if (!rootHasSingleFolder) expanded.add("folder:/");
        }
        // global: ALL collapsed including root by default (user clicks to expand)
        isInitialRender = false;
      }

      if (!treeRoot.children.length) {
        tree.innerHTML = '<div class="empty">No activity in this range.</div>';
        rightList.innerHTML = '<div class="empty">No snapshots to show.</div>';
        rightSub.textContent = "";
        bulkBtn.style.display = "none";
        return;
      }

      // bulk only for local + folder selected
      const folderSelected = selectedNodeId.startsWith("folder:/");
      bulkBtn.style.display = (scope === "local" && folderSelected) ? "inline-block" : "none";

      if (folderSelected) {
        if (scope === "local") {
          rightTitle.textContent = "Snapshots";
          rightSub.textContent = selectedFolderRel ? \`Folder: \${selectedFolderRel}\` : "Folder: (root)";
          rightList.innerHTML = '<div class="empty">Folder selected. Click a file to view snapshots. Use Bulk Revert to undo last session for this folder.</div>';
        } else {
          rightTitle.textContent = "Global";
          rightSub.textContent = "Expand project folders to see modified files.";
          rightList.innerHTML = '<div class="empty">Global view is read-only. It shows actual files modified across all projects in last 30 days (coding files only).</div>';
        }
      }

      renderTree(treeRoot);
    }

    vscode.postMessage({ type: "refresh" });
  </script>
</body>
</html>`;
    }
}
exports.HistoryPanel = HistoryPanel;
//# sourceMappingURL=historyPanel.js.map