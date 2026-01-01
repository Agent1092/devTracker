// src/historyPanel.ts
import * as vscode from "vscode";
import { getLatestSnapshots, getSnapshot } from "./apiClient";
import { runBulkRevertForFolder } from "./bulkRevert";

type SnapshotSummary = {
  id: number;
  file_path: string;
  created_at: string;
};

export class HistoryPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private installationId: string
  ) {}

  public async open() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      await this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "devtrackerHistory",
      "DevTracker — History",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.onDidDispose(() => (this.panel = undefined));

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg?.type === "openDiff") {
          if (!msg.snapshotId || !msg.filePath) return;
          await this.openDiff(Number(msg.snapshotId), String(msg.filePath));
          return;
        }

        if (msg?.type === "revert") {
          if (!msg.snapshotId || !msg.filePath) return;
          await this.revertToSnapshot(Number(msg.snapshotId), String(msg.filePath));
          return;
        }

        if (msg?.type === "bulkRevertFolder") {
          const folderRel = String(msg.folderRel ?? ""); // "" == workspace root
          await runBulkRevertForFolder({
            ctx: this.context,
            installationId: this.installationId,
            folderRel,
          });
          await this.refresh();
          return;
        }

        if (msg?.type === "refresh") {
          await this.refresh();
          return;
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`DevTracker: action failed: ${err?.message ?? err}`);
      }
    });

    this.panel.webview.html = this.html(this.panel.webview);
    await this.refresh();
  }

  private wsRoot(): string | null {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  }

  private prettifyAbsToRel(pAbs: string) {
    const root = this.wsRoot();
    if (root && pAbs.startsWith(root)) {
      return pAbs.slice(root.length).replace(/^[/\\]+/, "");
    }
    return pAbs;
  }

  private async refresh() {
    if (!this.panel) return;

    let snaps: SnapshotSummary[] = [];
    try {
      snaps = await getLatestSnapshots(this.installationId, 400);
    } catch (err: any) {
      this.panel.webview.postMessage({
        type: "error",
        message: `Could not load history. Is backend running? (${err?.message ?? err})`,
      });
      return;
    }

    const wsRoot = this.wsRoot();
    const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "Workspace";

    this.panel.webview.postMessage({
      type: "data",
      payload: { snaps, wsRoot, wsName },
    });
  }

  private async openDiff(snapshotId: number, filePathAbs: string) {
    const leftUri = vscode.Uri.parse(`devtracker-snapshot:/${snapshotId}`);
    const rightUri = vscode.Uri.file(filePathAbs);
    await vscode.commands.executeCommand(
      "vscode.diff",
      leftUri,
      rightUri,
      `DevTracker Diff: ${this.prettifyAbsToRel(filePathAbs)}`
    );
    try {
      await vscode.commands.executeCommand("workbench.action.compareEditor.nextChange");
    } catch {}
  }

  private async revertToSnapshot(snapshotId: number, filePathAbs: string) {
    const ok = await vscode.window.showWarningMessage(
      `Revert "${this.prettifyAbsToRel(filePathAbs)}" to snapshot #${snapshotId}?\n\nTip: You can undo with Ctrl+Z.`,
      { modal: true },
      "Revert"
    );
    if (ok !== "Revert") return;

    const snap = await getSnapshot(snapshotId);
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePathAbs));
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length)
    );

    await editor.edit((eb) => eb.replace(fullRange, snap.full_text ?? ""));
    vscode.window.showInformationMessage("DevTracker: Reverted (Ctrl+Z to undo).");
  }

  private html(webview: vscode.Webview) {
    const nonce = String(Date.now());
    return /* html */ `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root{
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: var(--vscode-panel-border);
    --accent: var(--vscode-button-background);
    --accentFg: var(--vscode-button-foreground);
    --inputBg: var(--vscode-input-background);
    --inputFg: var(--vscode-input-foreground);
    --hover: var(--vscode-list-hoverBackground);
    --active: var(--vscode-list-activeSelectionBackground);
    --activeFg: var(--vscode-list-activeSelectionForeground);
  }
  body{ margin:0; padding:12px; background:var(--bg); color:var(--fg); font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif; }
  .top{ display:flex; gap:10px; align-items:center; margin-bottom:12px; }
  .search{ flex:1; padding:8px 10px; border:1px solid var(--border); border-radius:10px; background:var(--inputBg); color:var(--inputFg); outline:none; }
  .btn{ padding:8px 12px; border:0; border-radius:10px; cursor:pointer; background:var(--accent); color:var(--accentFg); font-weight:900; }
  .badge{ font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid var(--border); color:var(--muted); font-weight:900; }
  .tabs{ display:flex; gap:8px; margin-bottom:12px; }
  .tab{ border:1px solid var(--border); background:transparent; color:var(--fg); padding:6px 10px; border-radius:999px; cursor:pointer; font-weight:900; font-size:12px; }
  .tab.active{ background:var(--active); color:var(--activeFg); border-color:transparent; }
  .grid{ display:grid; grid-template-columns: 360px 1fr; gap:12px; height: calc(100vh - 92px); }
  .card{ border:1px solid var(--border); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
  .header{ padding:10px 12px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:10px; font-weight:900; }
  .sub{ font-weight:700; font-size:12px; color:var(--muted); }
  .list{ overflow:auto; padding:6px; min-height:0; }
  .rowItem{ padding:8px 10px; border-radius:10px; cursor:pointer; user-select:none; }
  .rowItem:hover{ background:var(--hover); }
  .rowItem.active{ background:var(--active); color:var(--activeFg); }
  .treeRow{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .left{ display:flex; align-items:center; gap:8px; min-width:0; }
  .caret{ width:16px; text-align:center; opacity:.9; }
  .name{ font-weight:900; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .path{ font-size:12px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; }
  .indent{ margin-left:18px; }
  .mini{ border:1px solid var(--border); background:transparent; color:var(--fg); padding:4px 10px; border-radius:10px; cursor:pointer; font-weight:900; font-size:12px; }
  .mini:hover{ background:var(--hover); }
  .mini.danger{ color:#ff6b6b; }
  .mini:disabled{ opacity:.45; cursor:not-allowed; }
  .empty{ padding:14px; color:var(--muted); }
  .err{ display:none; border:1px solid var(--border); border-radius:14px; padding:12px; margin-bottom:12px; color:var(--muted); }
</style>
</head>
<body>
  <div id="err" class="err"></div>

  <div class="top">
    <input id="search" class="search" placeholder="Search file/folder..." />
    <button id="refresh" class="btn">Refresh</button>
  </div>

  <div class="tabs">
    <button class="tab active" data-mode="today">Today</button>
    <button class="tab" data-mode="week">Week</button>
    <button class="tab" data-mode="month">Month</button>
  </div>

  <div class="grid">
    <div class="card">
      <div class="header">
        <div style="display:flex; gap:10px; align-items:center;">
          <div>Explorer</div>
          <div class="sub" id="leftSub"></div>
        </div>
      </div>
      <div class="list" id="leftList"></div>
    </div>

    <div class="card">
      <div class="header">
        <div style="display:flex; gap:10px; align-items:center;">
          <div>Snapshots</div>
          <div class="sub" id="rightSub"></div>
        </div>
        <button id="bulkBtn" class="mini danger" disabled>Bulk Revert</button>
      </div>
      <div class="list" id="rightList"></div>
    </div>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  let snaps = [];
  let wsRoot = null;
  let wsName = "Workspace";
  let mode = "today";
  let selectedFileAbs = null;
  let selectedFolderRel = null; // "" for root
  const expanded = new Set();   // folderRel strings, "" root always expanded

  const err = document.getElementById("err");
  const leftSub = document.getElementById("leftSub");
  const leftList = document.getElementById("leftList");

  const rightSub = document.getElementById("rightSub");
  const rightList = document.getElementById("rightList");
  const bulkBtn = document.getElementById("bulkBtn");

  document.getElementById("refresh").onclick = () => vscode.postMessage({ type:"refresh" });
  document.getElementById("search").oninput = () => computeAndRender();

  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.mode;
      selectedFileAbs = null;
      selectedFolderRel = null;
      computeAndRender();
    };
  });

  bulkBtn.onclick = () => {
    if (bulkBtn.disabled) return;
    vscode.postMessage({ type:"bulkRevertFolder", folderRel: selectedFolderRel ?? "" });
  };

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
      snaps = msg.payload?.snaps || [];
      wsRoot = msg.payload?.wsRoot || null;
      wsName = msg.payload?.wsName || "Workspace";

      expanded.add(""); // root expanded always
      computeAndRender();
    }
  });

  function normalize(p){ return String(p||"").replace(/\\\\/g,"/"); }

  function isUnderWorkspace(abs){
    if (!wsRoot) return false;
    const a = normalize(abs);
    const r = normalize(wsRoot).replace(/\\/+$/,"");
    return a === r || a.startsWith(r + "/");
  }

  function relFromAbs(abs){
    const a = normalize(abs);
    const r = normalize(wsRoot).replace(/\\/+$/,"");
    if (a.startsWith(r + "/")) return a.slice(r.length + 1);
    if (a === r) return "";
    return a;
  }

  function fileName(rel){ return rel.split("/").pop() || rel; }

  function startOfDay(d){
    const x = new Date(d);
    x.setHours(0,0,0,0);
    return x;
  }

  function range() {
    const now = new Date();
    const start = startOfDay(now);
    if (mode === "today") {
      const end = new Date(start); end.setDate(end.getDate()+1);
      return { start, end };
    }
    if (mode === "week") {
      const s = new Date(start); s.setDate(s.getDate()-6);
      const e = new Date(start); e.setDate(e.getDate()+1);
      return { start:s, end:e };
    }
    const s = new Date(start); s.setDate(s.getDate()-29);
    const e = new Date(start); e.setDate(e.getDate()+1);
    return { start:s, end:e };
  }

  function fmt(iso){
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday:"short", day:"2-digit", month:"short", year:"numeric",
      hour:"2-digit", minute:"2-digit", second:"2-digit"
    });
  }

  function groupByFile(snapsInRange){
    const by = new Map();
    snapsInRange.forEach(s => {
      const arr = by.get(s.file_path) || [];
      arr.push(s);
      by.set(s.file_path, arr);
    });

    const out = [];
    for (const [abs, arr] of by.entries()){
      arr.sort((a,b)=> new Date(b.created_at)-new Date(a.created_at));
      const rel = relFromAbs(abs);
      out.push({
        abs,
        rel,
        name: fileName(rel),
        count: arr.length,
        lastAt: arr[0].created_at,
        versions: arr.map(v => ({ id:v.id, created_at:v.created_at, time: fmt(v.created_at) }))
      });
    }
    out.sort((a,b)=> new Date(b.lastAt)-new Date(a.lastAt));
    return out;
  }

  function folderRelOf(rel){
    const parts = normalize(rel).split("/").filter(Boolean);
    if (parts.length <= 1) return "";
    return parts.slice(0, parts.length-1).join("/");
  }

  function buildTree(groups){
    const root = { fullRel:"", folders:new Map(), files:[] };

    function ensure(node, folderRel){
      if (!folderRel) return node;
      const parts = folderRel.split("/").filter(Boolean);
      let cur = node;
      let accum = "";
      for (const p of parts){
        accum = accum ? (accum + "/" + p) : p;
        if (!cur.folders.has(p)){
          cur.folders.set(p, { fullRel: accum, folders:new Map(), files:[] });
        }
        cur = cur.folders.get(p);
      }
      return cur;
    }

    for (const g of groups){
      const folder = folderRelOf(g.rel);
      const node = ensure(root, folder);
      node.files.push(g);
    }
    return root;
  }

  function matchesQ(group, q){
    if (!q) return true;
    const s = q.toLowerCase();
    return (group.name||"").toLowerCase().includes(s) || (group.rel||"").toLowerCase().includes(s);
  }

  function countSnapshots(node){
    let total = 0;
    node.files.forEach(f => total += f.count);
    for (const child of node.folders.values()){
      total += countSnapshots(child);
    }
    return total;
  }

  function computeAndRender(){
    if (!wsRoot){
      leftList.innerHTML = '<div class="empty">Open a folder workspace to see history.</div>';
      rightList.innerHTML = '<div class="empty">No workspace open.</div>';
      return;
    }

    // ✅ Filter to workspace files only
    const workspaceSnaps = snaps.filter(s => isUnderWorkspace(s.file_path));

    const { start, end } = range();
    const snapsInRange = workspaceSnaps.filter(s => {
      const t = new Date(s.created_at);
      return t >= start && t < end;
    });

    const groups = groupByFile(snapsInRange);

    const q = document.getElementById("search").value.trim();
    const filtered = q ? groups.filter(g => matchesQ(g,q)) : groups;

    leftSub.textContent = filtered.length ? \`\${filtered.length} files\` : "";

    // selection cleanup
    if (selectedFileAbs && !filtered.some(g => g.abs === selectedFileAbs)) {
      selectedFileAbs = null;
    }

    const tree = buildTree(filtered);

    renderTree(tree);
    renderRight(filtered);
    syncBulk();
  }

  function syncBulk(){
    bulkBtn.disabled = (selectedFolderRel === null);
    bulkBtn.title = bulkBtn.disabled ? "Select a folder in explorer to enable" : \`Bulk revert "\${selectedFolderRel || wsName}"\`;
  }

  function renderTree(tree){
    leftList.innerHTML = "";
    if (countSnapshots(tree) === 0){
      leftList.innerHTML = '<div class="empty">No activity in this range.</div>';
      return;
    }

    renderFolder(tree, "", 0, true);
  }

  function renderFolder(node, folderRel, depth, isRoot=false){
    const label = isRoot ? wsName : folderRel.split("/").pop();
    const hasChildren = node.folders.size > 0 || node.files.length > 0;

    if (isRoot) expanded.add("");

    const isOpen = expanded.has(folderRel);
    const active = selectedFolderRel === folderRel && !selectedFileAbs;

    const el = document.createElement("div");
    el.className = "rowItem" + (active ? " active" : "");
    el.innerHTML = \`
      <div class="treeRow" style="margin-left:\${depth*18}px;">
        <div class="left">
          <span class="caret">\${hasChildren ? (isOpen ? "▾" : "▸") : "•"}</span>
          <span class="name">📁 \${label}</span>
        </div>
        <span class="badge">\${countSnapshots(node)}</span>
      </div>
      <div class="path">\${isRoot ? wsRoot : folderRel}</div>
    \`;

    // caret toggles, row selects folder
    el.onclick = () => {
      selectedFolderRel = folderRel;
      selectedFileAbs = null;
      if (hasChildren){
        if (expanded.has(folderRel)) expanded.delete(folderRel);
        else expanded.add(folderRel);
      }
      computeAndRender();
    };

    leftList.appendChild(el);

    if (!expanded.has(folderRel)) return;

    // folders
    const kids = Array.from(node.folders.entries())
      .map(([name, child]) => ({ name, child }))
      .sort((a,b)=> a.name.localeCompare(b.name));

    for (const k of kids){
      renderFolder(k.child, k.child.fullRel, depth+1, false);
    }

    // files
    const files = node.files.slice().sort((a,b)=> new Date(b.lastAt)-new Date(a.lastAt));
    for (const f of files){
      const fe = document.createElement("div");
      const fActive = selectedFileAbs === f.abs;
      fe.className = "rowItem" + (fActive ? " active" : "");
      fe.innerHTML = \`
        <div class="treeRow" style="margin-left:\${(depth+1)*18}px;">
          <div class="left">
            <span class="caret"></span>
            <span class="name">📄 \${f.name}</span>
          </div>
          <span class="badge">\${f.count}</span>
        </div>
        <div class="path">\${f.rel}</div>
      \`;
      fe.onclick = (ev) => {
        ev.stopPropagation();
        selectedFileAbs = f.abs;
        selectedFolderRel = folderRel; // keep folder context for bulk revert
        computeAndRender();
      };
      leftList.appendChild(fe);
    }
  }

  function renderRight(groups){
    rightList.innerHTML = "";

    const sel = selectedFileAbs ? groups.find(g => g.abs === selectedFileAbs) : null;

    if (!sel){
      rightSub.textContent = selectedFolderRel === null ? "Select a file to view snapshots." : \`Folder: \${selectedFolderRel || wsName}\`;
      rightList.innerHTML = '<div class="empty">Click a file to see Diff/Revert. Select a folder then use Bulk Revert.</div>';
      return;
    }

    rightSub.textContent = sel.rel;

    sel.versions.forEach(v => {
      const row = document.createElement("div");
      row.className = "rowItem";
      row.innerHTML = \`
        <div class="treeRow">
          <div class="left">
            <span class="name" style="font-weight:700;">\${v.time}</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="mini" data-act="diff">Diff</button>
            <button class="mini danger" data-act="revert">Revert</button>
          </div>
        </div>
        <div class="path">Snapshot #\${v.id}</div>
      \`;

      row.onclick = () => vscode.postMessage({ type:"openDiff", snapshotId: v.id, filePath: sel.abs });

      row.querySelector('[data-act="diff"]').onclick = (e) => {
        e.stopPropagation();
        vscode.postMessage({ type:"openDiff", snapshotId: v.id, filePath: sel.abs });
      };
      row.querySelector('[data-act="revert"]').onclick = (e) => {
        e.stopPropagation();
        vscode.postMessage({ type:"revert", snapshotId: v.id, filePath: sel.abs, snapshotIdNum: v.id });
      };

      rightList.appendChild(row);
    });
  }

  vscode.postMessage({ type:"refresh" });
</script>
</body>
</html>`;
  }
}
