// src/extension.ts
import * as vscode from "vscode";
import {
  getLatestSnapshots,
  getLocalSummary,
  pingBackend,
  postFileChange,
  setBackendUrl,
  type LocalSummaryResponse,
  type SnapshotSummary,
} from "./apiClient";
import { registerSnapshotProvider } from "./snapshotProvider";
import { HistoryPanel } from "./historyPanel";

import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import * as net from "net";
import * as fs from "fs";

let serverProc: ChildProcessWithoutNullStreams | null = null;
let backendUrl: string | null = null;

let installationId: string;
const changeTimers = new Map<string, ReturnType<typeof setTimeout>>();
function showWhatsNew(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "devtracker.whatsNew",
    "What's New — DevTracker",
    vscode.ViewColumn.One,
    { enableScripts: false }
  );

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
class DevTrackerHomeView implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly installationId: string
  ) {}

  resolveWebviewView(view: vscode.WebviewView) {
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
      if (!msg?.command) return;
      try {
        await vscode.commands.executeCommand(msg.command);
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `DevTracker: failed to run action (${msg.command}). ${err?.message ?? err}`
        );
      }
    });
  }


  
  private getHtml(webview: vscode.Webview) {
    const version = this.context.extension.packageJSON.version;

    // ✅ Use PNG for webview logo (best compatibility)
    // Put your file at: resources/logo.png
    const logoPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "resources",
      "activitybar.png"
    );
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

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => {
        if (typeof addr === "object" && addr) resolve(addr.port);
        else reject(new Error("no port"));
      });
    });
    srv.on("error", reject);
  });
}

function ensureDir(p: string) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {
    // ignore
  }
}

function getOrCreateInstallationId(context: vscode.ExtensionContext): string {
  const key = "devtracker.installationId";
  const existing = context.globalState.get<string>(key);
  if (existing) return existing;

  const newId = generatePseudoUuid();
  void context.globalState.update(key, newId);
  return newId;
}

async function startEmbeddedBackend(
  context: vscode.ExtensionContext
): Promise<string> {
  const port = await getFreePort();

  ensureDir(context.globalStorageUri.fsPath);
  const dbPath = path.join(context.globalStorageUri.fsPath, "devtracker.db");

  const serverEntry = context.asAbsolutePath(
    path.join("out", "server", "cli.js")
  );

  const proc = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      DEVTRACKER_DB_PATH: dbPath,
      DEVTRACKER_PORT: String(port),
    },
    stdio: "pipe",
    windowsHide: true,
  });

  serverProc = proc;

  proc.stderr.on("data", (d) =>
    console.error("[DevTracker server]", String(d))
  );
  proc.stdout.on("data", (d) =>
    console.log("[DevTracker server]", String(d))
  );

  return `http://127.0.0.1:${port}`;
}

async function waitForBackendReady(timeoutMs = 7000) {
  const start = Date.now();
  let lastErr: any = null;

  while (Date.now() - start < timeoutMs) {
    try {
      await pingBackend();
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  throw lastErr ?? new Error("Backend not reachable");
}

/**
 * Adds a bottom status bar button for quick access.
 */
function registerStatusBar(context: vscode.ExtensionContext) {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  item.text = "$(history) DevTracker";
  item.tooltip = "Open DevTracker History";
  item.command = "devtracker.openHistoryPanel";
  item.show();
  context.subscriptions.push(item);
}

export async function activate(context: vscode.ExtensionContext) {
  installationId = getOrCreateInstallationId(context);

  registerSnapshotProvider(context);

  // Start embedded backend
  try {
    backendUrl = await startEmbeddedBackend(context);
    setBackendUrl(backendUrl);
    await waitForBackendReady(15000);
  } catch (err: any) {
    vscode.window.showWarningMessage(
      `DevTracker: Could not start embedded backend. (${err?.message ?? err})`
    );
  }

  registerStatusBar(context);

  // ✅ Webview View provider for Activity Bar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "devtracker.home",
      new DevTrackerHomeView(context, installationId),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  const currentVersion = context.extension.packageJSON.version;
const lastVersion = context.globalState.get<string>("devtracker.lastVersion");

if (lastVersion !== currentVersion) {
  vscode.window
    .showInformationMessage(
      `DevTracker updated to v${currentVersion}`,
      "What's New"
    )
    .then((choice) => {
      if (choice === "What's New") {
        showWhatsNew(context);
      }
    });

  context.globalState.update("devtracker.lastVersion", currentVersion);
}

context.subscriptions.push(
  vscode.commands.registerCommand("devtracker.whatsNew", () => {
    showWhatsNew(context);
  })
);


  // Listener: capture changes (debounced)
  const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (!event.document.uri.fsPath) return;
    scheduleSnapshotSend(event.document);
  });
  context.subscriptions.push(changeListener);

  context.subscriptions.push({
    dispose: () => {
      changeTimers.forEach((t) => clearTimeout(t));
      changeTimers.clear();
    },
  });

  // History panel
  const historyPanel = new HistoryPanel(context, installationId);
  context.subscriptions.push(
    vscode.commands.registerCommand("devtracker.openHistoryPanel", async () => {
      await historyPanel.open();
    })
  );

  // Local summary
  context.subscriptions.push(
    vscode.commands.registerCommand("devtracker.showLocalSummary", async () => {
      try {
        const summary: LocalSummaryResponse = await getLocalSummary(
          installationId,
          new Date()
        );

        const lines = [
          `Date: ${summary.date}`,
          `Total files touched: ${summary.total_files}`,
          "",
          ...summary.files.map((f) => `- ${f.path} (snapshots: ${f.snapshots})`),
        ];

        vscode.window.showInformationMessage(lines.join("\n"), { modal: true });
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `DevTracker: failed to load summary: ${err?.message ?? err}`
        );
      }
    })
  );

  // Quick diff picker
  context.subscriptions.push(
    vscode.commands.registerCommand("devtracker.openRecentDiff", async () => {
      try {
        const snaps: SnapshotSummary[] = await getLatestSnapshots(
          installationId,
          60
        );

        if (!snaps.length) {
          vscode.window.showInformationMessage(
            "DevTracker: No snapshots found yet."
          );
          return;
        }

        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const prettifyPath = (p: string) => {
          if (wsRoot && p.startsWith(wsRoot)) {
            const rel = p.slice(wsRoot.length).replace(/^\/+/, "");
            return rel.length ? rel : p;
          }
          return p;
        };

        const fileNameOf = (p: string) => p.split(/[/\\]/).pop() || p;

        const grouped = new Map<string, SnapshotSummary[]>();
        for (const s of snaps) {
          const arr = grouped.get(s.file_path) ?? [];
          arr.push(s);
          grouped.set(s.file_path, arr);
        }

        for (const [, arr] of grouped) {
          arr.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
        }

        type PickItem = vscode.QuickPickItem & {
          snapshotId?: number;
          filePath?: string;
        };
        const items: PickItem[] = [];

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

        if (!picked || !picked.snapshotId || !picked.filePath) return;

        const leftUri = vscode.Uri.parse(
          `devtracker-snapshot:/${picked.snapshotId}`
        );
        const rightUri = vscode.Uri.file(picked.filePath);

        await vscode.commands.executeCommand(
          "vscode.diff",
          leftUri,
          rightUri,
          `DevTracker Diff: ${prettifyPath(picked.filePath)}`
        );

        try {
          await vscode.commands.executeCommand(
            "workbench.action.compareEditor.nextChange"
          );
        } catch {
          // ignore
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `DevTracker: Diff failed: ${err?.message ?? err}`
        );
      }
    })
  );

  // Report Issue / Feedback
  context.subscriptions.push(
    vscode.commands.registerCommand("devtracker.reportIssue", async () => {
      const sys = {
        vscode: vscode.version,
        platform: process.platform,
        arch: process.arch,
        node: process.versions.node,
        extensionVersion: context.extension.packageJSON.version,
      };

      const body = encodeURIComponent(
        `### Bug report\n\n` +
          `**Describe the issue:**\n\n` +
          `\n\n---\n` +
          `**System Info**\n` +
          `\`\`\`json\n${JSON.stringify(sys, null, 2)}\n\`\`\`\n`
      );

      const url = `https://github.com/Agent1092/devTracker/issues/new?body=${body}`;
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );
}

export function deactivate() {
  try {
    serverProc?.kill();
  } catch {
    // ignore
  }
}

function scheduleSnapshotSend(document: vscode.TextDocument) {
  const filePath = document.uri.fsPath;
  if (!filePath) return;

  const existing = changeTimers.get(filePath);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    changeTimers.delete(filePath);

    postFileChange({
      installation_id: installationId,
      file_path: filePath,
      project_root:
        vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ?? null,
      content: document.getText(),
      timestamp: new Date().toISOString(),
    }).catch((err) =>
      console.error("DevTracker: failed to send change", err)
    );
  }, 2000);

  changeTimers.set(filePath, timeout);
}

function generatePseudoUuid(): string {
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
  );
  return [
    bytes.slice(0, 4),
    bytes.slice(4, 6),
    bytes.slice(6, 8),
    bytes.slice(8, 10),
    bytes.slice(10, 16),
  ]
    .map((chunk) =>
      chunk.map((b) => b.toString(16).padStart(2, "0")).join("")
    )
    .join("-");
}
