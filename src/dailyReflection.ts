// src/dailyReflection.ts
import * as vscode from "vscode";
import { getLocalSummary, type LocalSummaryResponse } from "./apiClient";

type Reflection = {
  dateLabel: string;
  filesTouched: number;
  mainFocus: string;
  natureOfWork: string;
  netProgress: string;
  topFiles: { path: string; snapshots: number }[];
};

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function norm(p: string) {
  return (p || "").replace(/\\/g, "/");
}

function relToWs(abs: string, wsRoot: string) {
  const a = norm(abs);
  const r = norm(wsRoot).replace(/\/+$/, "");
  if (a === r) return "";
  if (a.startsWith(r + "/")) return a.slice(r.length + 1);
  return abs;
}

function topLevelFolder(rel: string) {
  const parts = norm(rel).split("/").filter(Boolean);
  return parts[0] ?? "(root)";
}

function extOf(rel: string) {
  const base = rel.split("/").pop() || rel;
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i + 1).toLowerCase() : "";
}

function detectMainFocus(files: { path: string; snapshots: number }[]) {
  // score by snapshots per top folder + keyword cluster
  const folderScore = new Map<string, number>();
  const keywordScore = new Map<string, number>();

  const keywords = [
    "auth",
    "oauth",
    "login",
    "token",
    "session",
    "entitlement",
    "sync",
    "history",
    "panel",
    "ui",
    "error",
    "exception",
    "fix",
    "bug",
    "test",
    "export",
    "summary",
    "notification",
    "db",
    "sqlite",
    "api",
  ];

  for (const f of files) {
    const rel = norm(f.path);
    const folder = topLevelFolder(rel);
    folderScore.set(folder, (folderScore.get(folder) ?? 0) + (f.snapshots ?? 1));

    const lower = rel.toLowerCase();
    for (const k of keywords) {
      if (lower.includes(k)) {
        keywordScore.set(k, (keywordScore.get(k) ?? 0) + (f.snapshots ?? 1));
      }
    }
  }

  const topFolder = [...folderScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topKeyword = [...keywordScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  if (topKeyword) {
    // Make it human
    const map: Record<string, string> = {
      oauth: "OAuth / login",
      auth: "Auth",
      login: "Login flow",
      token: "Token handling",
      session: "Session tracking",
      entitlement: "Entitlements",
      sync: "Sync",
      history: "History UI",
      panel: "Panels / UI",
      ui: "UI polish",
      error: "Error handling",
      exception: "Error handling",
      test: "Tests",
      export: "Exports",
      summary: "Summaries",
      notification: "Notifications",
      db: "Local DB",
      sqlite: "Local DB",
      api: "API plumbing",
      fix: "Bugfixing",
      bug: "Bugfixing",
    };
    return map[topKeyword] ?? topKeyword;
  }

  return topFolder ? `Working in ${topFolder}` : "General coding";
}

function detectNature(files: { path: string; snapshots: number }[]) {
  let tests = 0;
  let docs = 0;
  let config = 0;
  let code = 0;

  for (const f of files) {
    const rel = norm(f.path).toLowerCase();
    const ext = extOf(rel);
    const weight = f.snapshots ?? 1;

    if (rel.includes("/test") || rel.includes(".spec.") || rel.includes(".test.")) tests += weight;
    if (ext === "md") docs += weight;
    if (["json", "yml", "yaml", "toml", "ini", "properties", "gradle"].includes(ext)) config += weight;
    if (["ts", "tsx", "js", "jsx", "java", "kt", "py", "go", "rs", "c", "cpp", "hpp", "cs"].includes(ext)) code += weight;
  }

  const total = tests + docs + config + code;
  if (total <= 0) return "General updates";

  const pct = (x: number) => x / total;

  if (pct(tests) > 0.45) return "Mostly testing & verification";
  if (pct(config) > 0.35) return "Mostly configuration & wiring";
  if (pct(docs) > 0.35) return "Mostly documentation & notes";
  if (pct(code) > 0.55) return "Mostly coding & refactoring";
  return "Mixed development work";
}

function detectNetProgress(mainFocus: string, nature: string, filesTouched: number) {
  // Small “closure” phrasing. No AI, just good defaults.
  if (nature.includes("testing")) return "Confidence & stability improved";
  if (nature.includes("configuration")) return "Wiring & integration progressed";
  if (nature.includes("documentation")) return "Clarity & handoff improved";
  if (mainFocus.toLowerCase().includes("error")) return "Stability & edge cases improved";
  if (mainFocus.toLowerCase().includes("auth") || mainFocus.toLowerCase().includes("login"))
    return "Core workflow progressed";
  if (filesTouched >= 15) return "Broad cleanup & forward momentum";
  if (filesTouched <= 3) return "Small but meaningful progress";
  return "Steady progress & cleanup";
}

function buildReflection(wsRoot: string, summary: LocalSummaryResponse): Reflection {
  const topFiles = [...summary.files]
    .map((f) => ({
      path: relToWs(f.path, wsRoot),
      snapshots: f.snapshots,
    }))
    .sort((a, b) => b.snapshots - a.snapshots)
    .slice(0, 6);

  const mainFocus = detectMainFocus(topFiles);
  const natureOfWork = detectNature(topFiles);
  const netProgress = detectNetProgress(mainFocus, natureOfWork, summary.total_files);

  return {
    dateLabel: summary.date,
    filesTouched: summary.total_files,
    mainFocus,
    natureOfWork,
    netProgress,
    topFiles,
  };
}

function reflectionHtml(r: Reflection) {
  const li = r.topFiles
    .map(
      (f) =>
        `<li><code>${escapeHtml(f.path)}</code> <span style="opacity:.65">(${f.snapshots} snapshots)</span></li>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto; padding:16px; line-height:1.5;}
  h2{margin:0 0 4px;}
  .muted{opacity:.75; font-size:12px;}
  .card{border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:14px; margin-top:12px;}
  .row{display:flex; gap:12px; flex-wrap:wrap; margin-top:10px;}
  .pill{border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:6px 10px; font-size:12px; opacity:.9;}
  code{background:rgba(0,0,0,.22); border:1px solid rgba(255,255,255,.1); padding:2px 6px; border-radius:8px;}
</style>
</head>
<body>
  <h2>🧠 Yesterday at a glance</h2>
  <div class="muted">Date: ${escapeHtml(r.dateLabel)}</div>

  <div class="card">
    <div class="row">
      <div class="pill">Files touched: <b>${r.filesTouched}</b></div>
      <div class="pill">Main focus: <b>${escapeHtml(r.mainFocus)}</b></div>
      <div class="pill">Nature: <b>${escapeHtml(r.natureOfWork)}</b></div>
      <div class="pill">Net progress: <b>${escapeHtml(r.netProgress)}</b></div>
    </div>

    <div style="margin-top:12px; font-weight:800;">Top activity</div>
    <ul style="margin:8px 0 0; padding-left:18px;">${li || "<li class='muted'>No file list available.</li>"}</ul>
  </div>

  <div class="muted" style="margin-top:12px;">
    DevTracker is local-first. This reflection is auto-generated from your snapshots (no AI).
  </div>
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

/**
 * Shows yesterday reflection once per day.
 * "Silent" = no button needed; we show a low-friction notification,
 * and open a lightweight panel only if user clicks "View".
 */
export async function maybeShowDailyReflection(
  ctx: vscode.ExtensionContext,
  installationId: string
) {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsRoot) return;

  const now = new Date();
  const yesterday = startOfDay(addDays(now, -1));
  const keyDay = isoDay(yesterday);

  const lastShown = ctx.globalState.get<string>("devtracker.reflection.lastShownIso");
  if (lastShown === keyDay) return;

  // Only show after some minimum time (avoid showing at 00:01)
  // If it's before 06:00, still show "yesterday" on first open.
  // (good enough for habit loop)
  try {
    const summary = await getLocalSummary(installationId, yesterday);
    if (!summary || (summary.total_files ?? 0) <= 0) {
      // Don’t nag if no activity; still mark as shown to avoid spam loops
      await ctx.globalState.update("devtracker.reflection.lastShownIso", keyDay);
      return;
    }

    const r = buildReflection(wsRoot, summary);

    // non-intrusive: info toast with an optional View button
    const choice = await vscode.window.showInformationMessage(
      `DevTracker: Yesterday — ${r.filesTouched} files • ${r.mainFocus} • ${r.netProgress}`,
      "View",
      "Dismiss"
    );

    if (choice === "View") {
      const panel = vscode.window.createWebviewPanel(
        "devtracker.dailyReflection",
        "DevTracker — Daily Reflection",
        vscode.ViewColumn.One,
        { enableScripts: false }
      );
      panel.webview.html = reflectionHtml(r);
    }

    await ctx.globalState.update("devtracker.reflection.lastShownIso", keyDay);
  } catch {
    // if backend not ready etc, do nothing (and don't mark as shown)
  }
}
