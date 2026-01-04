import * as vscode from "vscode";
import { getLocalSummary, type LocalSummaryResponse } from "./apiClient";

// Keep 1 panel instance max (so it feels modal, not “new tab spam”)
let localSummaryPanel: vscode.WebviewPanel | null = null;

export async function openLocalSummaryView(
  context: vscode.ExtensionContext,
  installationId: string
) {
  const nonce = String(Date.now());

  const summary: LocalSummaryResponse = await getLocalSummary(installationId, new Date());

  const files = [...(summary.files || [])]
    .sort((a, b) => (b.snapshots ?? 0) - (a.snapshots ?? 0))
    .slice(0, 6);

  const totalSnapshots = (summary.files || []).reduce((acc, f) => acc + (f.snapshots ?? 0), 0);

  const focus =
    files[0]?.path
      ? (files[0].path.replace(/\\/g, "/").split("/").filter(Boolean).slice(-2, -1)[0] || "General coding")
      : "No activity";

  const intensity =
    totalSnapshots <= 5 ? "Quick touch" : totalSnapshots <= 20 ? "Steady sessions" : "Deep work";

  const nature =
    (summary.files || []).some((f) => /(\.test\.|\.spec\.|\/test\/)/i.test(f.path))
      ? "Mostly testing & verification"
      : (summary.files || []).some((f) => /\.(json|yml|yaml|toml|ini|properties)$/i.test(f.path))
        ? "Mostly configuration & wiring"
        : "Mostly coding & refactoring";

  const net =
    nature.includes("testing") ? "Confidence & stability improved"
    : nature.includes("configuration") ? "Integration progressed"
    : totalSnapshots ? "Small but meaningful progress" : "—";

  // If already open, just update + reveal (still feels modal)
  if (localSummaryPanel) {
    localSummaryPanel.webview.html = renderLocalSummaryHtml({
      nonce,
      summary,
      files,
      totalSnapshots,
      focus,
      intensity,
      nature,
      net,
    });
    localSummaryPanel.reveal(vscode.ViewColumn.Active, true);
    return;
  }

  localSummaryPanel = vscode.window.createWebviewPanel(
    "devtracker.localSummaryPopup",
    " ", // important: minimal tab feel
    { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: false,
    }
  );

  localSummaryPanel.onDidDispose(() => (localSummaryPanel = null));

  localSummaryPanel.webview.onDidReceiveMessage(async (msg) => {
    if (msg?.type === "close") {
      localSummaryPanel?.dispose();
      return;
    }
    if (msg?.type === "history") {
      await vscode.commands.executeCommand("devtracker.openHistoryPanel");
      localSummaryPanel?.dispose();
      return;
    }
  });

  localSummaryPanel.webview.html = renderLocalSummaryHtml({
    nonce,
    summary,
    files,
    totalSnapshots,
    focus,
    intensity,
    nature,
    net,
  });
}

function renderLocalSummaryHtml(args: {
  nonce: string;
  summary: LocalSummaryResponse;
  files: { path: string; snapshots: number }[];
  totalSnapshots: number;
  focus: string;
  intensity: string;
  nature: string;
  net: string;
}) {
  const { nonce, summary, files, totalSnapshots, focus, intensity, nature, net } = args;

  return `<!doctype html>
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
    --btnBg: var(--vscode-button-background);
    --btnFg: var(--vscode-button-foreground);
  }
  body{
    margin:0;
    font-family: system-ui, -apple-system, Segoe UI, Roboto;
    color:var(--fg);
    background: transparent;
    overflow:hidden;
  }
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
  .title{ font-weight:900; font-size:16px; margin:0; }
  .sub{ margin-top:4px; font-size:12px; color:var(--muted); }
  .actions{ display:flex; gap:8px; align-items:center; }
  .btn{
    border:1px solid rgba(255,255,255,.12);
    background: transparent;
    color: var(--fg);
    padding: 7px 10px;
    border-radius: 10px;
    cursor:pointer;
    font-weight:900;
    font-size:12px;
  }
  .btn:hover{ background: rgba(255,255,255,.06); }
  .primary{
    border:0;
    background: var(--btnBg);
    color: var(--btnFg);
  }
  .content{ padding: 14px 16px 16px; }
  .pills{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
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
  @media (max-width: 720px){ .grid{ grid-template-columns: 1fr; } }
  .card{
    border:1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.02);
    border-radius: 14px;
    padding: 12px;
  }
  .cardTitle{ font-weight:900; font-size:12px; margin-bottom:8px; }
  .listItem{
    display:flex;
    justify-content:space-between;
    gap:10px;
    padding: 8px 8px;
    border-radius: 12px;
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
    <div class="modal" role="dialog" aria-modal="true">
      <div class="top">
        <div>
          <div class="title">✨ Local Summary</div>
          <div class="sub">Date: ${escapeHtml(summary.date || new Date().toISOString().slice(0, 10))}</div>
        </div>
        <div class="actions">
          <button class="btn" id="history">Open History</button>
          <button class="btn primary" id="close">Got it</button>
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
            ${
              files.length
                ? files
                    .map((f) => {
                      const p = f.path.replace(/\\\\/g, "/");
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
                : `<div class="path">No snapshots yet.</div>`
            }
          </div>

          <div class="card">
            <div class="cardTitle">Quick take</div>
            <div class="path">• Generated locally (no AI).</div>
            <div class="path">• Use History for diffs & revert.</div>
            <div class="hint">ESC / outside click closes.</div>
          </div>
        </div>
      </div>
    </div>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  document.getElementById("close").addEventListener("click", () => vscode.postMessage({ type: "close" }));
  document.getElementById("history").addEventListener("click", () => vscode.postMessage({ type: "history" }));

  // Close on overlay click (outside the modal)
  document.querySelector(".overlay").addEventListener("click", (e) => {
    if (e.target && e.target.classList && e.target.classList.contains("overlay")) {
      vscode.postMessage({ type: "close" });
    }
  });

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") vscode.postMessage({ type: "close" });
  });

  // Optional: auto-close if ignored (feels non-intrusive)
  let interacted = false;
  ["mousemove","keydown","mousedown","touchstart"].forEach(evt =>
    window.addEventListener(evt, () => interacted = true, { once: true })
  );
  setTimeout(() => {
    if (!interacted) vscode.postMessage({ type: "close" });
  }, 8000);
</script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
