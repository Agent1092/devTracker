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
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("./apiClient");
function toIsoDay(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
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
                    if (!msg.snapshotId || !msg.filePath)
                        return;
                    await this.openDiff(Number(msg.snapshotId), String(msg.filePath));
                    return;
                }
                if (msg?.type === "revert") {
                    if (!msg.snapshotId || !msg.filePath)
                        return;
                    await this.revertToSnapshot(Number(msg.snapshotId), String(msg.filePath));
                    return;
                }
                if (msg?.type === "refresh") {
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
    prettifyPath(p) {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (wsRoot && p.startsWith(wsRoot)) {
            const rel = p.slice(wsRoot.length).replace(/^\/+/, "");
            return rel.length ? rel : p;
        }
        return p;
    }
    async refresh() {
        if (!this.panel)
            return;
        let snaps = [];
        try {
            // Fetch recent snapshots
            snaps = await (0, apiClient_1.getLatestSnapshots)(this.installationId, 200);
        }
        catch (err) {
            this.panel.webview.postMessage({
                type: "error",
                message: `Could not load history. Is backend running? (${err?.message ?? err})`,
            });
            return;
        }
        // Build day counts (for Month view)
        const dayCounts = new Map();
        for (const s of snaps) {
            const d = new Date(s.created_at);
            const iso = toIsoDay(d);
            dayCounts.set(iso, (dayCounts.get(iso) ?? 0) + 1);
        }
        // Build last 31 days list (even if no activity)
        const today = startOfDay(new Date());
        const days = [];
        for (let i = 0; i < 31; i++) {
            const day = addDays(today, -i);
            const iso = toIsoDay(day);
            const label = day.toLocaleDateString(undefined, {
                weekday: "short",
                day: "2-digit",
                month: "short",
            });
            days.push({ isoDate: iso, label, count: dayCounts.get(iso) ?? 0 });
        }
        this.panel.webview.postMessage({
            type: "data",
            payload: { snaps, days },
        });
    }
    async openDiff(snapshotId, filePath) {
        const leftUri = vscode.Uri.parse(`devtracker-snapshot:/${snapshotId}`);
        const rightUri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, `DevTracker Diff: ${this.prettifyPath(filePath)}`);
        try {
            await vscode.commands.executeCommand("workbench.action.compareEditor.nextChange");
        }
        catch {
            // ignore
        }
    }
    async revertToSnapshot(snapshotId, filePath) {
        const ok = await vscode.window.showWarningMessage(`Revert "${this.prettifyPath(filePath)}" to snapshot #${snapshotId}?\n\nTip: You can undo with Ctrl+Z.`, { modal: true }, "Revert");
        if (ok !== "Revert")
            return;
        const snap = await (0, apiClient_1.getSnapshot)(snapshotId);
        const snapshotText = snap.full_text;
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        await editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, snapshotText);
        });
        vscode.window.showInformationMessage("DevTracker: Reverted (Ctrl+Z to undo).");
    }
    html(webview) {
        const nonce = String(Date.now());
        return /* html */ `
<!doctype html>
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

    .top {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 12px;
    }

    .localRow {
      margin: -4px 0 10px;
      color: var(--muted);
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modeBadge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--inputBg);
      color: var(--muted);
      font-weight: 800;
      font-size: 12px;
    }

    .dotLocal {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
      opacity: 0.8;
      display: inline-block;
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
      font-weight: 800;
    }

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .tab {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--fg);
      padding: 6px 10px;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 800;
      font-size: 12px;
    }
    .tab.active { background: var(--listActive); color: var(--listActiveFg); border-color: transparent; }

    .grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 12px;
      height: calc(100vh - 120px);
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
    }

    .sub {
      font-weight: 700;
      font-size: 12px;
      color: var(--muted);
    }

    .list {
      overflow: auto;
      padding: 6px;
      min-height: 0;
    }

    .item {
      padding: 10px 10px;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .item:hover { background: var(--listHover); }
    .item.active { background: var(--listActive); color: var(--listActiveFg); }

    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

    .fileName { font-weight: 900; }
    .path {
      font-size: 12px;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pill {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted);
      font-weight: 900;
    }

    .time {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      color: var(--muted);
    }

    .actions { display: flex; gap: 8px; align-items: center; }
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

    .dayDot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      display: inline-block;
      margin-right: 8px;
      background: transparent;
    }
    .dot0 { opacity: 0.25; }
    .dot1 { opacity: 0.55; }
    .dot2 { opacity: 0.75; }
    .dot3 { opacity: 1.0; background: var(--accent); border-color: transparent; }

    .empty { padding: 16px; color: var(--muted); }
  </style>
</head>

<body>
  <div id="err" class="errBox"></div>

  <div class="top">
    <input id="search" class="search" placeholder="Search file (name or path)..." />
    <button id="refresh" class="btn">Refresh</button>
  </div>

  <div class="localRow">
    <div class="modeBadge"><span class="dotLocal"></span>Local mode: data stays on this machine (no cloud)</div>
  </div>

  <div class="tabs">
    <button class="tab active" data-mode="today">Today</button>
    <button class="tab" data-mode="week">Week</button>
    <button class="tab" data-mode="month">Month</button>
  </div>

  <div class="grid">
    <div class="card">
      <div class="cardHeader">
        <div id="leftTitle">Files</div>
        <div class="sub" id="leftSub"></div>
      </div>
      <div class="list" id="leftList"></div>
    </div>

    <div class="card">
      <div class="cardHeader">
        <div>Snapshots</div>
        <div class="sub" id="rightSub"></div>
      </div>
      <div class="list" id="rightList"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let rawSnaps = [];
    let days = [];
    let mode = "today";          // today | week | month
    let selectedDay = null;      // YYYY-MM-DD for month mode
    let fileGroups = [];         // computed groups
    let filtered = [];           // after search
    let selectedFileIndex = 0;

    const err = document.getElementById("err");

    const leftTitle = document.getElementById("leftTitle");
    const leftSub = document.getElementById("leftSub");
    const leftList = document.getElementById("leftList");

    const rightSub = document.getElementById("rightSub");
    const rightList = document.getElementById("rightList");

    const search = document.getElementById("search");
    const refreshBtn = document.getElementById("refresh");

    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        mode = btn.dataset.mode;
        selectedDay = null;
        selectedFileIndex = 0;
        computeAndRender();
      });
    });

    refreshBtn.addEventListener("click", () => vscode.postMessage({ type: "refresh" }));

    search.addEventListener("input", () => {
      selectedFileIndex = 0;
      computeAndRender();
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

        rawSnaps = (msg.payload?.snaps || []);
        days = (msg.payload?.days || []);

        // quick sanity log (view it in Webview DevTools)
        console.log("[DevTracker] snaps:", rawSnaps.length, "days:", days.length);

        selectedFileIndex = 0;
        computeAndRender();
      }
    });

    function fmt(iso) {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }

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

      if (selectedDay) {
        const s = new Date(selectedDay + "T00:00:00");
        const e = new Date(s);
        e.setDate(e.getDate()+1);
        return { start: s, end: e };
      }

      const s = new Date();
      s.setHours(0,0,0,0);
      s.setDate(s.getDate()-30);
      const e = new Date();
      e.setDate(e.getDate()+1);
      e.setHours(0,0,0,0);
      return { start: s, end: e };
    }

    function groupByFile(snaps) {
      const by = new Map();
      snaps.forEach(s => {
        const arr = by.get(s.file_path) || [];
        arr.push(s);
        by.set(s.file_path, arr);
      });

      const groups = [];
      for (const [filePath, arr] of by.entries()) {
        arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        const lastAtIso = arr[0].created_at;

        groups.push({
          filePath,
          fileName: filePath.split(/[/\\\\]/).pop() || filePath,
          relPath: filePath,
          lastAtIso,
          count: arr.length,
          versions: arr.map(v => ({
            id: v.id,
            time: fmt(v.created_at),       // ✅ per snapshot
            created_at: v.created_at,
          }))
        });
      }

      groups.sort((a,b) => new Date(b.lastAtIso) - new Date(a.lastAtIso));
      return groups;
    }

    function computeAndRender() {
      const { start, end } = computeRangeFilter();
      const snapsInRange = rawSnaps.filter(s => {
        const t = new Date(s.created_at);
        return t >= start && t < end;
      });

      fileGroups = groupByFile(snapsInRange);

      const q = search.value.trim().toLowerCase();
      filtered = !q ? fileGroups : fileGroups.filter(g =>
        (g.fileName || "").toLowerCase().includes(q) ||
        (g.relPath || "").toLowerCase().includes(q)
      );

      if (mode === "month" && !selectedDay) {
        leftTitle.textContent = "Days (last 31)";
        leftSub.textContent = "";
        renderDays();
        rightSub.textContent = selectedDay ? selectedDay : "Pick a day";
        rightList.innerHTML = '<div class="empty">Select a day to view files and snapshots.</div>';
        return;
      }

      leftTitle.textContent = "Files";
      leftSub.textContent = filtered.length ? \`\${filtered.length} files\` : "";
      renderFiles();
      renderSnapshots();
    }

    function dotClass(count) {
      if (count <= 0) return "dot0";
      if (count <= 5) return "dot1";
      if (count <= 15) return "dot2";
      return "dot3";
    }

    function renderDays() {
      leftList.innerHTML = "";
      if (!days.length) {
        leftList.innerHTML = '<div class="empty">No data yet.</div>';
        return;
      }

      days.forEach((d) => {
        const el = document.createElement("div");
        el.className = "item";
        el.innerHTML = \`
          <div class="row">
            <div><span class="dayDot \${dotClass(d.count)}"></span><b>\${d.label}</b></div>
            <div class="pill">\${d.count}</div>
          </div>
          <div class="path">\${d.isoDate}</div>
        \`;
        el.onclick = () => {
          selectedDay = d.isoDate;
          computeAndRender();
        };
        leftList.appendChild(el);
      });
    }

    function renderFiles() {
      leftList.innerHTML = "";

      if (!filtered.length) {
        leftList.innerHTML = '<div class="empty">No activity in this range.</div>';
        rightList.innerHTML = '<div class="empty">No snapshots to show.</div>';
        rightSub.textContent = "";
        return;
      }

      filtered.forEach((f, idx) => {
        const el = document.createElement("div");
        el.className = "item" + (idx === selectedFileIndex ? " active" : "");
        el.innerHTML = \`
          <div class="row">
            <div class="fileName">📄 \${f.fileName}</div>
            <div class="pill">\${f.count}</div>
          </div>
          <div class="path">\${f.relPath}</div>
        \`;
        el.onclick = () => { selectedFileIndex = idx; renderFiles(); renderSnapshots(); };
        leftList.appendChild(el);
      });
    }

    function renderSnapshots() {
      rightList.innerHTML = "";
      if (!filtered.length) return;

      const sel = filtered[selectedFileIndex] || filtered[0];
      if (!sel) return;

      rightSub.textContent = sel.relPath;

      sel.versions.forEach(v => {
        const el = document.createElement("div");
        el.className = "item";
        el.onclick = () => vscode.postMessage({ type: "openDiff", snapshotId: v.id, filePath: sel.filePath });

        el.innerHTML = \`
          <div class="row">
            <div class="time"><b>\${v.time}</b></div>
            <div class="actions">
              <button class="mini" data-action="diff">Diff</button>
              <button class="mini danger" data-action="revert">Revert</button>
            </div>
          </div>
          <div class="path">Snapshot #\${v.id}</div>
        \`;

        el.querySelector('[data-action="diff"]').onclick = (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: "openDiff", snapshotId: v.id, filePath: sel.filePath });
        };

        el.querySelector('[data-action="revert"]').onclick = (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: "revert", snapshotId: v.id, filePath: sel.filePath });
        };

        rightList.appendChild(el);
      });
    }

    vscode.postMessage({ type: "refresh" });
  </script>
</body>
</html>`;
    }
}
exports.HistoryPanel = HistoryPanel;
//# sourceMappingURL=historyPanel.js.map