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
exports.activate = activate;
exports.getCurrentSessionStart = getCurrentSessionStart;
exports.deactivate = deactivate;
// src/extension.ts
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("./apiClient");
const snapshotProvider_1 = require("./snapshotProvider");
const historyPanel_1 = require("./historyPanel");
const notifications_1 = require("./notifications");
const session_1 = require("./session"); // ✅ NEW
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const bulkRevert_1 = require("./bulkRevert");
const dailyReflection_1 = require("./dailyReflection");
const weeklyExport_1 = require("./weeklyExport");
const localSummaryView_1 = require("./localSummaryView");
let serverProc = null;
let backendUrl = null;
let installationId;
const changeTimers = new Map();
let statusItem = null;
let sessionSnapshotCount = 0;
const diskTimers = new Map();
const recentHashes = new Map(); // prevents duplicates
let _ctx = null; // ✅ move up so activate can set it
function showWhatsNew(context) {
    const panel = vscode.window.createWebviewPanel("devtracker.whatsNew", "What's New — DevTracker", vscode.ViewColumn.One, { enableScripts: false });
    const version = context.extension.packageJSON.version;
    panel.webview.html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body {
    font-family: system-ui, -apple-system, Segoe UI, Roboto;
    background: #0b1220;
    color: #e7eefc;
    padding: 24px;
  }
  h1 { margin-top: 0; }
  ul { padding-left: 18px; }
  li { margin: 8px 0; }
  .ver { opacity: .7; font-size: 13px; }
</style>
</head>
<body>
  <h1>🚀 DevTracker v${version}</h1>
  <p class="ver">Beta update</p>

  <h3>What’s new</h3>
  <ul>
    <li>Activity Bar integration</li>
    <li>One-click DevTracker home panel</li>
    <li>Improved local summary UI</li>
    <li>Stability improvements for embedded backend</li>
  </ul>

  <h3>What’s coming</h3>
  <ul>
    <li>Weekly & monthly summaries</li>
    <li>Manager-friendly summaries</li>
    <li>Optional cloud sync (opt-in)</li>
  </ul>

  <p><b>DevTracker remains local-first.</b></p>
</body>
</html>
`;
}
/**
 * DevTracker "Home" sidebar view (Webview View):
 * Big buttons for ease-of-use.
 */
class DevTrackerHomeView {
    constructor(context, installationId) {
        this.context = context;
        this.installationId = installationId;
    }
    resolveWebviewView(view) {
        this.view = view;
        view.webview.options = {
            enableScripts: true,
            // ✅ allow loading local resources from /resources folder
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, "resources"),
            ],
        };
        view.webview.html = this.getHtml(view.webview);
        view.webview.onDidReceiveMessage(async (msg) => {
            if (!msg?.command)
                return;
            try {
                await vscode.commands.executeCommand(msg.command);
            }
            catch (err) {
                vscode.window.showErrorMessage(`DevTracker: failed to run action (${msg.command}). ${err?.message ?? err}`);
            }
        });
    }
    getHtml(webview) {
        const version = this.context.extension.packageJSON.version;
        // ✅ Use PNG for webview logo (best compatibility)
        // Put your file at: resources/logo.png
        const logoPath = vscode.Uri.joinPath(this.context.extensionUri, "resources", "activitybar.png");
        const logoUri = webview.asWebviewUri(logoPath);
        const shortId = `${this.installationId.slice(0, 8)}…`;
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root{
    --bg:#0b1220;
    --text:#e7eefc;
    --muted:rgba(231,238,252,.68);
    --border:rgba(255,255,255,.12);
    --btn:rgba(255,255,255,.06);
    --btnHover:rgba(255,255,255,.10);
    --chipBg:rgba(255,255,255,.04);
  }
  body{
    margin:0;
    padding:14px;
    background:var(--bg);
    color:var(--text);
    font-family:system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Noto Sans", Arial;
  }
  .title{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-bottom:10px;
  }
  .brand{
    display:flex;
    align-items:center;
    gap:10px;
    font-weight:900;
    font-size:18px;
    letter-spacing:.2px;
  }
  .brand img{
  width:28px;
  height:28px;
  border-radius:8px;
  display:block;

  /* important: prevent theme/icon tinting + preserve colors */
  filter: none !important;
  opacity: 1 !important;
  mix-blend-mode: normal !important;
  image-rendering: auto;
}

  .sub{
    color:var(--muted);
    font-size:12px;
    margin:0 0 12px;
    line-height:1.4;
  }
  .grid{
    display:grid;
    gap:10px;
  }
  button{
    width:100%;
    border:1px solid var(--border);
    background:var(--btn);
    color:var(--text);
    border-radius:12px;
    padding:10px 12px;
    cursor:pointer;
    text-align:left;
    font-weight:650;
    display:flex;
    align-items:center;
    gap:10px;
  }
  button:hover{ background:var(--btnHover); }
  .hint{
    margin-top:12px;
    color:var(--muted);
    font-size:12px;
    line-height:1.4;
  }
  .row{
    margin-top:10px;
    display:flex;
    gap:8px;
    flex-wrap:wrap;
  }
  .chip{
    border:1px solid var(--border);
    background:var(--chipBg);
    color:var(--muted);
    border-radius:999px;
    padding:6px 10px;
    font-size:11px;
  }
  code{
    background:rgba(0,0,0,.25);
    border:1px solid rgba(255,255,255,.10);
    border-radius:10px;
    padding:2px 6px;
  }
</style>
</head>
<body>
  <div class="title">
    <div class="brand">
      <img src="${logoUri}" alt="DevTracker"/>
      <span>DevTracker (Beta)</span>
    </div>
    <span style="color:var(--muted); font-weight:800;">v${version}</span>
  </div>

  <p class="sub">
    One-click access for daily workflow.<br/>
    Installation ID: <code>${shortId}</code>
  </p>

  <div class="grid">
    <button onclick="run('devtracker.openHistoryPanel')">🗂️ Open History Panel</button>
    <button onclick="run('devtracker.openRecentDiff')">🧾 Open Recent Diff</button>
    <button onclick="run('devtracker.showLocalSummary')">✨ Show Local Summary</button>
    <button onclick="run('devtracker.reportIssue')">🛠️ Report Issue / Feedback</button>
    <button onclick="run('devtracker.exportWeeklyReflection')">🗓️ Export Weekly Reflection</button>
    <button onclick="run('devtracker.exportMonthlyReflection')">🗓️ Export Monthly Reflection</button>
  </div>

  <div class="hint">
    Tip: Pin DevTracker in the Activity Bar for one-click access.<br/>
    Also see the bottom status bar button: <code>DevTracker</code>.
  </div>

  <div class="row">
    <div class="chip">Local-first</div>
    <div class="chip">Dark-mode friendly</div>
    <div class="chip">Fast workflow</div>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  function run(command){
    vscode.postMessage({ command });
  }
</script>
</body>
</html>`;
    }
}
async function getFreePort() {
    return await new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, "127.0.0.1", () => {
            const addr = srv.address();
            srv.close(() => {
                if (typeof addr === "object" && addr)
                    resolve(addr.port);
                else
                    reject(new Error("no port"));
            });
        });
        srv.on("error", reject);
    });
}
function ensureDir(p) {
    try {
        fs.mkdirSync(p, { recursive: true });
    }
    catch {
        // ignore
    }
}
function getOrCreateInstallationId(context) {
    const key = "devtracker.installationId";
    const existing = context.globalState.get(key);
    if (existing)
        return existing;
    const newId = generatePseudoUuid();
    void context.globalState.update(key, newId);
    return newId;
}
async function showLocalSummaryPopup(context, installationId) {
    const nonce = String(Date.now());
    // fetch summary
    const summary = await (0, apiClient_1.getLocalSummary)(installationId, new Date());
    // Top 6 files (already has snapshots count)
    const files = [...(summary.files || [])]
        .sort((a, b) => (b.snapshots ?? 0) - (a.snapshots ?? 0))
        .slice(0, 6);
    const totalSnapshots = files.reduce((acc, f) => acc + (f.snapshots ?? 0), 0);
    const focus = files[0]?.path
        ? (files[0].path.replace(/\\/g, "/").split("/").filter(Boolean).slice(-2, -1)[0] || "General coding")
        : "No activity";
    const intensity = totalSnapshots <= 5 ? "Quick touch" : totalSnapshots <= 20 ? "Steady sessions" : "Deep work";
    const nature = files.some((f) => /(\.test\.|\.spec\.|\/test\/)/i.test(f.path)) ? "Mostly testing & verification"
        : files.some((f) => /\.(json|yml|yaml|toml|ini|properties)$/i.test(f.path)) ? "Mostly configuration & wiring"
            : "Mostly coding & refactoring";
    const net = nature.includes("testing") ? "Confidence & stability improved"
        : nature.includes("configuration") ? "Integration progressed"
            : totalSnapshots ? "Small but meaningful progress" : "—";
    const panel = vscode.window.createWebviewPanel("devtracker.localSummaryPopup", "DevTracker — Local Summary", { viewColumn: vscode.ViewColumn.Active, preserveFocus: true }, {
        enableScripts: true,
        retainContextWhenHidden: false,
    });
    panel.webview.html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root{
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: rgba(255,255,255,.12);
    --card: rgba(255,255,255,.04);
    --hover: var(--vscode-list-hoverBackground);
    --btnBg: var(--vscode-button-background);
    --btnFg: var(--vscode-button-foreground);
  }

  body{
    margin:0;
    font-family: system-ui, -apple-system, Segoe UI, Roboto;
    color:var(--fg);
    background: transparent;
  }

  /* "Blurred overlay" look */
  .overlay{
    position:fixed;
    inset:0;
    background: rgba(0,0,0,.38);
    backdrop-filter: blur(10px);
    display:flex;
    align-items:center;
    justify-content:center;
    padding: 24px;
  }

  .modal{
    width: min(760px, 96vw);
    border: 1px solid var(--border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--bg) 85%, #000 15%);
    box-shadow: 0 14px 60px rgba(0,0,0,.55);
    overflow:hidden;
  }

  .top{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:14px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,.08);
  }

  .title{
    font-weight: 900;
    font-size: 16px;
    margin:0;
  }
  .sub{
    margin-top:4px;
    font-size: 12px;
    color: var(--muted);
  }

  .actions{
    display:flex;
    gap:8px;
    align-items:center;
  }

  .btn{
    border:1px solid rgba(255,255,255,.12);
    background: transparent;
    color: var(--fg);
    padding: 7px 10px;
    border-radius: 10px;
    cursor:pointer;
    font-weight: 900;
    font-size: 12px;
  }
  .btn:hover{ background: rgba(255,255,255,.06); }

  .primary{
    border:0;
    background: var(--btnBg);
    color: var(--btnFg);
  }

  .content{
    padding: 14px 16px 16px;
  }

  .pills{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-bottom: 12px;
  }
  .pill{
    border:1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.03);
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
  }

  .grid{
    display:grid;
    grid-template-columns: 1.2fr .8fr;
    gap:12px;
  }
  @media (max-width: 720px){
    .grid{ grid-template-columns: 1fr; }
  }

  .card{
    border:1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.02);
    border-radius: 14px;
    padding: 12px;
  }

  .cardTitle{
    font-weight: 900;
    font-size: 12px;
    margin-bottom: 8px;
    opacity:.95;
  }

  .listItem{
    display:flex;
    justify-content:space-between;
    gap:10px;
    padding: 8px 8px;
    border-radius: 12px;
    cursor: default;
  }
  .listItem:hover{ background: rgba(255,255,255,.04); }
  .path{
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow:hidden;
    text-overflow: ellipsis;
    max-width: 520px;
  }
  .name{
    font-weight: 900;
    font-size: 12px;
    white-space: nowrap;
    overflow:hidden;
    text-overflow: ellipsis;
  }
  .badge{
    border:1px solid rgba(255,255,255,.12);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    color: var(--muted);
    height: fit-content;
    margin-top:2px;
  }

  .hint{
    margin-top: 10px;
    font-size: 11px;
    color: var(--muted);
  }
</style>
</head>

<body>
  <div class="overlay">
    <div class="modal">
      <div class="top">
        <div>
          <div class="title">✨ Local Summary</div>
          <div class="sub">Date: ${escapeHtml(summary.date || new Date().toISOString().slice(0, 10))}</div>
        </div>

        <div class="actions">
          <button class="btn" id="history">Open History</button>
          <button class="btn primary" id="close">Done</button>
        </div>
      </div>

      <div class="content">

        <div class="pills">
          <div class="pill">Files touched: <b>${summary.total_files}</b></div>
          <div class="pill">Snapshots: <b>${totalSnapshots}</b></div>
          <div class="pill">Intensity: <b>${escapeHtml(intensity)}</b></div>
        </div>

        <div class="pills" style="margin-top:-2px;">
          <div class="pill">Main focus: <b>${escapeHtml(focus)}</b></div>
          <div class="pill">Nature: <b>${escapeHtml(nature)}</b></div>
          <div class="pill">Net progress: <b>${escapeHtml(net)}</b></div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="cardTitle">Top activity</div>
            ${files.length
        ? files
            .map((f) => {
            const p = f.path.replace(/\\/g, "/");
            const parts = p.split("/").filter(Boolean);
            const name = parts[parts.length - 1] || p;
            return `
                        <div class="listItem">
                          <div style="min-width:0;">
                            <div class="name">📄 ${escapeHtml(name)}</div>
                            <div class="path">${escapeHtml(p)}</div>
                          </div>
                          <div class="badge">${f.snapshots}</div>
                        </div>
                      `;
        })
            .join("")
        : `<div class="path">No snapshots yet for today.</div>`}
          </div>

          <div class="card">
            <div class="cardTitle">Quick take</div>
            <div class="path">• This is generated locally (no AI).</div>
            <div class="path">• Use History for diffs & revert.</div>
            <div class="hint">Tip: If this feels too much, we can show only top 3 files + 3 pills.</div>
          </div>
        </div>

      </div>
    </div>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.getElementById("close").addEventListener("click", () => vscode.postMessage({ type: "close" }));
  document.getElementById("history").addEventListener("click", () => vscode.postMessage({ type: "history" }));

  // close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") vscode.postMessage({ type: "close" });
  });
</script>
</body>
</html>`;
    panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg?.type === "close") {
            panel.dispose();
            return;
        }
        if (msg?.type === "history") {
            await vscode.commands.executeCommand("devtracker.openHistoryPanel");
            panel.dispose();
            return;
        }
    });
}
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
async function startEmbeddedBackend(context) {
    const port = await getFreePort();
    ensureDir(context.globalStorageUri.fsPath);
    const dbPath = path.join(context.globalStorageUri.fsPath, "devtracker_free.db");
    const serverEntry = context.asAbsolutePath(path.join("out", "server", "cli.js"));
    const proc = (0, child_process_1.spawn)(process.execPath, [serverEntry], {
        env: {
            ...process.env,
            DEVTRACKER_DB_PATH: dbPath,
            DEVTRACKER_PORT: String(port),
        },
        stdio: "pipe",
        windowsHide: true,
    });
    serverProc = proc;
    proc.stderr.on("data", (d) => console.error("[DevTracker server]", String(d)));
    proc.stdout.on("data", (d) => console.log("[DevTracker server]", String(d)));
    return `http://127.0.0.1:${port}`;
}
async function waitForBackendReady(timeoutMs = 7000) {
    const start = Date.now();
    let lastErr = null;
    while (Date.now() - start < timeoutMs) {
        try {
            await (0, apiClient_1.pingBackend)();
            return;
        }
        catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 250));
        }
    }
    throw lastErr ?? new Error("Backend not reachable");
}
/**
 * Adds a bottom status bar button for quick access.
 */
function registerStatusBar(context) {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    item.command = "devtracker.openHistoryPanel";
    item.text = "$(history) DevTracker";
    item.tooltip = "Open DevTracker History";
    item.show();
    context.subscriptions.push(item);
    statusItem = item;
    updateStatusBar();
}
function updateStatusBar() {
    if (!statusItem)
        return;
    if (sessionSnapshotCount > 0) {
        statusItem.text = `$(history) DevTracker +${sessionSnapshotCount}`;
        statusItem.tooltip = `${sessionSnapshotCount} snapshot(s) recorded this session. Click to open history.`;
    }
    else {
        statusItem.text = "$(history) DevTracker";
        statusItem.tooltip = "Open DevTracker History";
    }
}
async function activate(context) {
    _ctx = context; // ✅ NEW: makes deactivate work
    (0, session_1.markSessionStart)(context); // ✅ NEW: start session tracking
    installationId = getOrCreateInstallationId(context);
    (0, snapshotProvider_1.registerSnapshotProvider)(context);
    //   context.subscriptions.push(
    //   vscode.window.onDidChangeWindowState((e) => {
    //     // if window becomes inactive, treat as session end checkpoint
    //     if (!e.focused) markSessionEnd(context);
    //   })
    // );
    context.subscriptions.push(vscode.commands.registerCommand("devtracker.exportWeeklyReflection", async () => {
        try {
            await (0, weeklyExport_1.exportWeeklyInsight)(installationId);
        }
        catch (err) {
            vscode.window.showErrorMessage(`DevTracker: weekly export failed: ${err?.message ?? err}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("devtracker.exportMonthlyReflection", async () => {
        try {
            await (0, weeklyExport_1.exportMonthlyInsight)(installationId);
        }
        catch (err) {
            vscode.window.showErrorMessage(`DevTracker: monthly export failed: ${err?.message ?? err}`);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(() => {
        // lightweight checkpoint (optional)
    }));
    // ✅ Capture AI-agent / disk writes (unopened files)
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (wsRoot) {
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(wsRoot, "**/*"));
        watcher.onDidChange((uri) => scheduleDiskSnapshot(uri.fsPath));
        watcher.onDidCreate((uri) => scheduleDiskSnapshot(uri.fsPath));
        watcher.onDidDelete(() => { });
        context.subscriptions.push(watcher);
    }
    context.subscriptions.push(vscode.env.onDidChangeTelemetryEnabled(() => {
        // no-op, just ensures env events don't break
    }));
    _ctx = context;
    (0, session_1.markSessionStart)(context);
    // ✅ End session checkpoint when VS Code window loses focus
    context.subscriptions.push(vscode.window.onDidChangeWindowState((e) => {
        if (!e.focused) {
            (0, session_1.markSessionEnd)(context);
            // Immediately start a fresh session when user comes back
        }
        else {
            (0, session_1.markSessionStart)(context);
        }
    }));
    // ✅ (optional) also checkpoint end when VS Code is closing docs/workspace
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
        (0, session_1.markSessionEnd)(context);
        (0, session_1.markSessionStart)(context);
    }));
    // Start embedded backend
    try {
        backendUrl = await startEmbeddedBackend(context);
        (0, apiClient_1.setBackendUrl)(backendUrl);
        await waitForBackendReady(15000);
    }
    catch (err) {
        vscode.window.showWarningMessage(`DevTracker: Could not start embedded backend. (${err?.message ?? err})`);
    }
    registerStatusBar(context);
    sessionSnapshotCount = 0;
    updateStatusBar();
    // ✅ Webview View provider for Activity Bar
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("devtracker.home", new DevTrackerHomeView(context, installationId), { webviewOptions: { retainContextWhenHidden: true } }));
    context.subscriptions.push(vscode.commands.registerCommand("devtracker.bulkRevertWizard", async () => {
        await (0, bulkRevert_1.runBulkRevertWizard)({ ctx: context, installationId });
    }));
    setTimeout(() => {
        (0, notifications_1.runStartupNotifications)(context, installationId);
        // ✅ Daily Reflection (silent habit loop)
        void (0, dailyReflection_1.maybeShowDailyReflection)(context, installationId);
    }, 1200);
    const currentVersion = context.extension.packageJSON.version;
    const lastVersion = context.globalState.get("devtracker.lastVersion");
    if (lastVersion !== currentVersion) {
        vscode.window
            .showInformationMessage(`DevTracker updated to v${currentVersion}`, "What's New")
            .then((choice) => {
            if (choice === "What's New") {
                showWhatsNew(context);
            }
        });
        context.globalState.update("devtracker.lastVersion", currentVersion);
    }
    context.subscriptions.push(vscode.commands.registerCommand("devtracker.whatsNew", () => {
        showWhatsNew(context);
    }));
    // Listener: capture changes (debounced)
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (!event.document.uri.fsPath)
            return;
        scheduleSnapshotSend(event.document);
    });
    context.subscriptions.push(changeListener);
    context.subscriptions.push({
        dispose: () => {
            changeTimers.forEach((t) => clearTimeout(t));
            changeTimers.clear();
            diskTimers.forEach((t) => clearTimeout(t));
            diskTimers.clear();
        },
    });
    // History panel
    const historyPanel = new historyPanel_1.HistoryPanel(context, installationId);
    context.subscriptions.push(vscode.commands.registerCommand("devtracker.openHistoryPanel", async () => {
        await historyPanel.open();
    }));
    // Local summary
    context.subscriptions.push(vscode.commands.registerCommand("devtracker.showLocalSummary", async () => {
        try {
            await (0, localSummaryView_1.openLocalSummaryView)(context, installationId);
        }
        catch (err) {
            vscode.window.showErrorMessage(`DevTracker: failed to load local summary: ${err?.message ?? err}`);
        }
    }));
    // Quick diff picker
    context.subscriptions.push(vscode.commands.registerCommand("devtracker.openRecentDiff", async () => {
        try {
            const snaps = await (0, apiClient_1.getLatestSnapshots)(installationId, 60);
            if (!snaps.length) {
                vscode.window.showInformationMessage("DevTracker: No snapshots found yet.");
                return;
            }
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const prettifyPath = (p) => {
                if (wsRoot && p.startsWith(wsRoot)) {
                    const rel = p.slice(wsRoot.length).replace(/^\/+/, "");
                    return rel.length ? rel : p;
                }
                return p;
            };
            const fileNameOf = (p) => p.split(/[/\\]/).pop() || p;
            const grouped = new Map();
            for (const s of snaps) {
                const arr = grouped.get(s.file_path) ?? [];
                arr.push(s);
                grouped.set(s.file_path, arr);
            }
            for (const [, arr] of grouped) {
                arr.sort((a, b) => new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime());
            }
            const items = [];
            const fileEntries = Array.from(grouped.entries()).sort(([, a], [, b]) => {
                const ta = new Date(a[0].created_at).getTime();
                const tb = new Date(b[0].created_at).getTime();
                return tb - ta;
            });
            for (const [filePath, versions] of fileEntries) {
                items.push({
                    label: `📄 ${fileNameOf(filePath)}`,
                    description: prettifyPath(filePath),
                    kind: vscode.QuickPickItemKind.Separator,
                });
                for (const v of versions) {
                    items.push({
                        label: `   ⏱ ${new Date(v.created_at).toLocaleString()}`,
                        description: "Open diff",
                        snapshotId: v.id,
                        filePath: v.file_path,
                    });
                }
            }
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: "Select a file + time to open diff (grouped by file)",
                matchOnDescription: true,
            });
            if (!picked || !picked.snapshotId || !picked.filePath)
                return;
            const leftUri = vscode.Uri.parse(`devtracker-snapshot:/${picked.snapshotId}`);
            const rightUri = vscode.Uri.file(picked.filePath);
            await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, `DevTracker Diff: ${prettifyPath(picked.filePath)}`);
            try {
                await vscode.commands.executeCommand("workbench.action.compareEditor.nextChange");
            }
            catch {
                // ignore
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`DevTracker: Diff failed: ${err?.message ?? err}`);
        }
    }));
    // Report Issue / Feedback
    context.subscriptions.push(vscode.commands.registerCommand("devtracker.reportIssue", async () => {
        const sys = {
            vscode: vscode.version,
            platform: process.platform,
            arch: process.arch,
            node: process.versions.node,
            extensionVersion: context.extension.packageJSON.version,
        };
        const body = encodeURIComponent(`### Bug report\n\n` +
            `**Describe the issue:**\n\n` +
            `\n\n---\n` +
            `**System Info**\n` +
            `\`\`\`json\n${JSON.stringify(sys, null, 2)}\n\`\`\`\n`);
        const url = `https://github.com/Agent1092/devTracker/issues/new?body=${body}`;
        vscode.env.openExternal(vscode.Uri.parse(url));
    }));
}
function getCurrentSessionStart(ctx) {
    return ctx.globalState.get("devtracker.session.currentStart") ?? null;
}
function deactivate() {
    try {
        if (_ctx)
            (0, session_1.markSessionEnd)(_ctx); // ✅ FIXED
        serverProc?.kill();
    }
    catch {
        // ignore
    }
}
function scheduleSnapshotSend(document) {
    const filePath = document.uri.fsPath;
    if (!filePath)
        return;
    // ❌ Ignore untitled / virtual docs
    if (document.isUntitled)
        return;
    // ❌ Ignore binary / noisy paths (keep list minimal)
    const p = filePath.replace(/\\/g, "/").toLowerCase();
    if (p.includes("/.git/") ||
        p.includes("/node_modules/") ||
        p.includes("/dist/") ||
        p.includes("/build/") ||
        p.includes("/out/") ||
        p.includes("/.next/") ||
        p.includes("/.cache/")) {
        return;
    }
    const existing = changeTimers.get(filePath);
    if (existing)
        clearTimeout(existing);
    const timeout = setTimeout(() => {
        changeTimers.delete(filePath);
        // ✅ Resolve correct workspace root (important for Local vs Global)
        const wf = vscode.workspace.getWorkspaceFolder(document.uri);
        const projectRoot = wf?.uri.fsPath ?? null;
        // ✅ Increment session count (UX visibility)
        sessionSnapshotCount++;
        updateStatusBar();
        (0, apiClient_1.postFileChange)({
            installation_id: installationId,
            file_path: filePath,
            project_root: projectRoot,
            content: document.getText(),
            timestamp: new Date().toISOString(),
            // 🔮 Optional future-proofing (safe to add now)
            // source: "editor", // uncomment later if backend supports
        }).catch((err) => console.error("DevTracker: failed to send change", err));
    }, 2000); // debounce stays same
    changeTimers.set(filePath, timeout);
}
function shouldIgnoreFile(filePath) {
    // keep this strict; you can expand later
    const p = filePath.replace(/\\/g, "/").toLowerCase();
    // ignore common heavy/noisy folders
    if (p.includes("/.git/") ||
        p.includes("/node_modules/") ||
        p.includes("/dist/") ||
        p.includes("/out/") ||
        p.includes("/build/") ||
        p.includes("/.next/") ||
        p.includes("/.turbo/") ||
        p.includes("/.cache/") ||
        p.includes("/coverage/") ||
        p.includes("/.vscode/") // optional; remove if you want settings changes
    )
        return true;
    // ignore binaries
    if (/\.(png|jpe?g|gif|webp|ico|pdf|zip|7z|tar|gz|woff2?|ttf|mp4|mov|avi|exe|dll)$/i.test(p))
        return true;
    return false;
}
function fastHash(s) {
    // lightweight hash to dedupe repeats
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
}
function scheduleDiskSnapshot(filePath) {
    if (vscode.workspace.textDocuments.some(d => d.uri.fsPath === filePath && !d.isClosed)) {
        return; // let onDidChangeTextDocument handle open files
    }
    if (!filePath)
        return;
    if (shouldIgnoreFile(filePath))
        return;
    const existing = diskTimers.get(filePath);
    if (existing)
        clearTimeout(existing);
    const t = setTimeout(() => {
        diskTimers.delete(filePath);
        // file may be deleted/renamed quickly
        let content = "";
        try {
            // skip huge files (protect perf)
            const stat = fs.statSync(filePath);
            const maxBytes = 1000000; // 1MB, tune later
            if (!stat.isFile() || stat.size > maxBytes)
                return;
            content = fs.readFileSync(filePath, "utf8");
        }
        catch {
            return;
        }
        const h = fastHash(content);
        if (recentHashes.get(filePath) === h)
            return; // dedupe
        recentHashes.set(filePath, h);
        sessionSnapshotCount++;
        updateStatusBar();
        (0, apiClient_1.postFileChange)({
            installation_id: installationId,
            file_path: filePath,
            project_root: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
            content,
            timestamp: new Date().toISOString(),
        }).catch((err) => console.error("DevTracker: disk-change send failed", err));
    }, 600); // debounce for agent bursts
    diskTimers.set(filePath, t);
}
function generatePseudoUuid() {
    const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    return [
        bytes.slice(0, 4),
        bytes.slice(4, 6),
        bytes.slice(6, 8),
        bytes.slice(8, 10),
        bytes.slice(10, 16),
    ]
        .map((chunk) => chunk.map((b) => b.toString(16).padStart(2, "0")).join(""))
        .join("-");
}
//# sourceMappingURL=extension.js.map